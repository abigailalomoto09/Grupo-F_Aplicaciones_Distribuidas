const Partida = require('./models/Partida');

async function createPartida({ host, players = [], maxRounds = 3, roundTime = 60 }) {
  const partida = await Partida.create({
    host,
    players,
    maxRounds,
    roundTime,
    status: 'waiting'
  });
  return partida;
}

async function getPartidaById(id) {
  return Partida.findById(id).lean();
}

async function updatePartida(id, updates) {
  return Partida.findByIdAndUpdate(id, updates, { returnDocument: 'after' }).lean();
}

async function addOrUpdatePlayer(partidaId, player) {
  const partida = await Partida.findById(partidaId);
  if (!partida) return null;

  const idx = partida.players.findIndex(p => p.username === player.username);
  if (idx !== -1) {
    partida.players[idx] = { ...partida.players[idx].toObject(), ...player };
  } else {
    partida.players.push(player);
  }

  await partida.save();
  return partida.toObject();
}

async function setCurrentWord(partidaId, word) {
  return updatePartida(partidaId, { currentWord: word });
}

async function setCurrentDrawer(partidaId, index) {
  return updatePartida(partidaId, { currentDrawerIndex: index });
}

async function markPartidaPlaying(partidaId) {
  return updatePartida(partidaId, { status: 'playing' });
}

async function markPartidaFinished(partidaId) {
  return updatePartida(partidaId, { status: 'finished', roundEndsAt: new Date() });
}

module.exports = {
  createPartida,
  getPartidaById,
  updatePartida,
  addOrUpdatePlayer,
  setCurrentWord,
  setCurrentDrawer,
  markPartidaPlaying,
  markPartidaFinished
};
