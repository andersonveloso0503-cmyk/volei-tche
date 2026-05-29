const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const BASE_URL = 'https://andersonveloso0503-cmyk.github.io/volei-tche/';

// Nomes dos coordenadores para receber notificação de desafio
const COORDENADORES = ['Raubustt (Arroz)'];  // coordenador principal

async function buscarTokens(nomes) {
  if (!nomes || nomes.length === 0) return [];
  const db = admin.firestore();
  const snap = await db.collection('tokens').get();
  console.log('Total tokens:', snap.size, '| Buscando:', nomes);
  return snap.docs
    .map(d => d.data())
    .filter(d => nomes.includes(d.nome) && d.token)
    .map(d => d.token);
}

async function buscarTodosTokens() {
  const db = admin.firestore();
  const snap = await db.collection('tokens').get();
  return snap.docs.map(d => d.data()).filter(d => d.token).map(d => d.token);
}

async function enviarPush(tokens, titulo, corpo, url) {
  if (!tokens || tokens.length === 0) { console.log('Nenhum token.'); return; }
  console.log('Enviando push para', tokens.length, 'tokens');
  const message = {
    tokens,
    notification: { title: titulo, body: corpo },
    webpush: {
      notification: { icon: '/volei-tche/logo192.png', requireInteraction: true },
      fcmOptions: { link: url || BASE_URL },
    },
  };
  try {
    const resp = await admin.messaging().sendEachForMulticast(message);
    console.log('Push: sucesso=' + resp.successCount + ' falha=' + resp.failureCount);
  } catch (err) {
    console.error('Erro push:', err.message);
  }
}

// ── FUNCTION 1 — CONVOCAÇÃO ──────────────────────────────────
exports.onJogoCriado = onDocumentCreated(
  { document: 'jogos/{jogoId}', region: 'us-east1' },
  async (event) => {
    const jogo = event.data.data();
    const jogoId = event.params.jogoId;
    console.log('Jogo criado:', jogoId, '| Jogadores:', jogo.jogadores);

    if (!jogo.jogadores || jogo.jogadores.length === 0) return;

    const dataFmt = jogo.data
      ? new Date(jogo.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
      : 'Data a confirmar';

    const titulo = '🏐 Você foi convocado — Volei Tche!';
    const corpo  = `${jogo.modalidade} • ${dataFmt} às ${jogo.hora || '--:--'}${jogo.adversario ? ' vs ' + jogo.adversario : ''}\nEntre na sua Área do Jogador, clique em Atualizar e BORA LÁ! 🏐`;
    const url    = `${BASE_URL}?jogo=${jogoId}`;

    const tokens = await buscarTokens(jogo.jogadores);
    await enviarPush(tokens, titulo, corpo, url);

    // ── Lembrete 4h depois para quem não confirmou ──
    const db = admin.firestore();
    const lembreteTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await db.collection('lembretes_pendentes').add({
      jogoId,
      jogadores: jogo.jogadores,
      modalidade: jogo.modalidade,
      data: jogo.data,
      hora: jogo.hora,
      local: jogo.local,
      adversario: jogo.adversario || '',
      enviarEm: lembreteTime,
      enviado: false,
    });
    console.log('Lembrete 4h agendado para:', lembreteTime);
  }
);

// ── FUNCTION 2 — PLACAR / MVP ────────────────────────────────
exports.onPlacarSalvo = onDocumentUpdated(
  { document: 'jogos/{jogoId}', region: 'us-east1' },
  async (event) => {
    const antes  = event.data.before.data();
    const depois = event.data.after.data();
    const jogoId = event.params.jogoId;

    if (antes.placar || !depois.placar) return;

    const placar    = depois.placar;
    const jogadores = depois.jogadores || [];
    if (jogadores.length === 0) return;

    const res   = placar.resultado;
    const emoji = res === 'vitoria' ? '🏆 Vitória!' : res === 'derrota' ? '😤 Derrota' : '🤝 Empate';
    const sets  = `${placar.nosVencemos || 0}x${placar.elesVenceram || 0}`;

    const titulo = `${emoji} Vote no MVP!`;
    const corpo  = `${sets} vs ${placar.adversario || 'Adversário'} — Quem foi o melhor?`;
    const url    = `${BASE_URL}?mvp=${jogoId}`;

    const tokens = await buscarTokens(jogadores);
    await enviarPush(tokens, titulo, corpo, url);
  }
);

// ── FUNCTION 3 — LEMBRETE DIA DO JOGO (08h) ─────────────────
exports.lembretesDiarios = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'America/Sao_Paulo', region: 'us-east1' },
  async () => {
    const db   = admin.firestore();
    const hoje = new Date().toISOString().split('T')[0];
    console.log('Verificando jogos para:', hoje);

    const snap = await db.collection('jogos').where('data', '==', hoje).get();
    if (snap.empty) { console.log('Nenhum jogo hoje.'); return; }

    for (const docJogo of snap.docs) {
      const jogo   = docJogo.data();
      const jogoId = docJogo.id;
      if (jogo.cancelado || !jogo.jogadores || jogo.jogadores.length === 0) continue;

      const confirmados = Object.values(jogo.confirmacoes || {}).filter(v => v === 'sim').length;
      const titulo = `⏰ Jogo HOJE — ${jogo.modalidade}${jogo.adversario ? ' vs ' + jogo.adversario : ''}!`;
      const corpo  = `${jogo.hora || '--:--'} • ${jogo.local || 'Local a confirmar'} — ${confirmados}/${jogo.jogadores.length} confirmados`;
      const url    = `${BASE_URL}?jogo=${jogoId}`;

      const tokens = await buscarTokens(jogo.jogadores);
      await enviarPush(tokens, titulo, corpo, url);
    }
  }
);

// ── FUNCTION 4 — LEMBRETE 4H para quem não confirmou ────────
exports.lembretes4h = onSchedule(
  { schedule: 'every 30 minutes', region: 'us-east1' },
  async () => {
    const db  = admin.firestore();
    const now = new Date();
    console.log('Verificando lembretes 4h pendentes:', now.toISOString());

    const snap = await db.collection('lembretes_pendentes')
      .where('enviado', '==', false)
      .get();

    for (const d of snap.docs) {
      const lem = d.data();
      const enviarEm = new Date(lem.enviarEm);

      if (now < enviarEm) continue; // ainda não chegou a hora

      // Busca o jogo atualizado para ver quem ainda não confirmou
      const jogoDoc = await db.collection('jogos').doc(lem.jogoId).get();
      if (!jogoDoc.exists) {
        await d.ref.update({ enviado: true });
        continue;
      }

      const jogo = jogoDoc.data();
      if (jogo.cancelado) {
        await d.ref.update({ enviado: true });
        continue;
      }

      // Filtra só quem NÃO confirmou
      const pendentes = (lem.jogadores || []).filter(nome => {
        const conf = jogo.confirmacoes?.[nome];
        return !conf || conf === 'pendente';
      });

      if (pendentes.length > 0) {
        const titulo = '⚠️ Você ainda não confirmou!';
        const corpo  = `${lem.modalidade}${lem.adversario ? ' vs ' + lem.adversario : ''} — Confirme sua presença!`;
        const url    = `${BASE_URL}?jogo=${lem.jogoId}`;

        const tokens = await buscarTokens(pendentes);
        await enviarPush(tokens, titulo, corpo, url);
        console.log(`Lembrete 4h enviado para ${pendentes.length} pendentes do jogo ${lem.jogoId}`);
      }

      await d.ref.update({ enviado: true });
    }
  }
);

// ── FUNCTION 5 — NOTIFICAÇÃO DE DESAFIO para coordenadores ──
exports.onDesafioCriado = onDocumentCreated(
  { document: 'desafios/{desafioId}', region: 'us-east1' },
  async (event) => {
    const desafio   = event.data.data();
    const desafioId = event.params.desafioId;

    console.log('Desafio criado:', desafioId, '| Time:', desafio.time);

    const jogadoresLista = (desafio.jogadores || []).filter(j => j).join(', ');
    const titulo = '⚔️ Novo desafio recebido!';
    const corpo  = `${desafio.time} quer jogar ${desafio.modalidade} em ${desafio.data || 'data a combinar'}${jogadoresLista ? '\nJogadores: ' + jogadoresLista : ''} — Contato: ${desafio.contato}`;
    const url    = BASE_URL;

    // Envia para os coordenadores cadastrados
    const tokens = await buscarTokens(COORDENADORES);
    await enviarPush(tokens, titulo, corpo, url);
    console.log(`Notificação de desafio enviada para ${tokens.length} coordenadores.`);
  }
);
