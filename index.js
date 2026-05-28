const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const BASE_URL = 'https://andersonveloso0503-cmyk.github.io/volei-tche/';

async function buscarTokens(nomes) {
  if (!nomes || nomes.length === 0) return [];
  const db = admin.firestore();
  const snap = await db.collection('tokens').get();
  console.log('Total tokens:', snap.size, '| Buscando:', nomes);
  return snap.docs.map(d => d.data()).filter(d => nomes.includes(d.nome) && d.token).map(d => d.token);
}

async function enviarPush(tokens, titulo, corpo, url) {
  if (!tokens || tokens.length === 0) { console.log('Nenhum token encontrado.'); return; }
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
    console.log('Push enviado — sucesso:', resp.successCount, 'falha:', resp.failureCount);
  } catch (err) {
    console.error('Erro push:', err.message);
  }
}

exports.onJogoCriado = onDocumentCreated(
  { document: 'jogos/{jogoId}', region: 'us-east1' },
  async (event) => {
    const jogo = event.data.data();
    const jogoId = event.params.jogoId;
    console.log('Jogo criado:', jogoId, '| Jogadores:', jogo.jogadores);
    if (!jogo.jogadores || jogo.jogadores.length === 0) return;
    const dataFmt = jogo.data ? new Date(jogo.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : 'Data a confirmar';
    const titulo = '🏐 Você foi convocado — Volei Tche!';
    const corpo = `${jogo.modalidade} • ${dataFmt} às ${jogo.hora || '--:--'}${jogo.adversario ? ' vs ' + jogo.adversario : ''} | Toque para confirmar!`;
    const url = `${BASE_URL}?jogo=${jogoId}`;
    const tokens = await buscarTokens(jogo.jogadores);
    await enviarPush(tokens, titulo, corpo, url);
  }
);

exports.onPlacarSalvo = onDocumentUpdated(
  { document: 'jogos/{jogoId}', region: 'us-east1' },
  async (event) => {
    const antes = event.data.before.data();
    const depois = event.data.after.data();
    const jogoId = event.params.jogoId;
    if (antes.placar || !depois.placar) return;
    const placar = depois.placar;
    const jogadores = depois.jogadores || [];
    if (jogadores.length === 0) return;
    const res = placar.resultado;
    const emoji = res === 'vitoria' ? '🏆 Vitória!' : res === 'derrota' ? '😤 Derrota' : '🤝 Empate';
    const sets = `${placar.nosVencemos || 0}x${placar.elesVenceram || 0}`;
    const titulo = `${emoji} Vote no MVP!`;
    const corpo = `${sets} vs ${placar.adversario || 'Adversário'} — Toque para votar!`;
    const url = `${BASE_URL}?mvp=${jogoId}`;
    const tokens = await buscarTokens(jogadores);
    await enviarPush(tokens, titulo, corpo, url);
  }
);

exports.lembretesDiarios = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'America/Sao_Paulo', region: 'us-east1' },
  async () => {
    const db = admin.firestore();
    const hoje = new Date().toISOString().split('T')[0];
    console.log('Verificando jogos para:', hoje);
    const snap = await db.collection('jogos').where('data', '==', hoje).get();
    if (snap.empty) { console.log('Nenhum jogo hoje.'); return; }
    for (const docJogo of snap.docs) {
      const jogo = docJogo.data();
      const jogoId = docJogo.id;
      if (jogo.cancelado || !jogo.jogadores || jogo.jogadores.length === 0) continue;
      const confirmados = Object.values(jogo.confirmacoes || {}).filter(v => v === 'sim').length;
      const titulo = `⏰ Jogo HOJE — ${jogo.modalidade}${jogo.adversario ? ' vs ' + jogo.adversario : ''}!`;
      const corpo = `${jogo.hora || '--:--'} • ${jogo.local || 'Local a confirmar'} — ${confirmados}/${jogo.jogadores.length} confirmados`;
      const url = `${BASE_URL}?jogo=${jogoId}`;
      const tokens = await buscarTokens(jogo.jogadores);
      await enviarPush(tokens, titulo, corpo, url);
    }
  }
);