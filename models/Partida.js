const mongoose = require('mongoose');

const JugadorRefSchema = new mongoose.Schema({
  username: { type: String, required: true },
  socketId: { type: String, default: '' },
  online: { type: Boolean, default: true },
  score: { type: Number, default: 0 }
}, { _id: false });

const PartidaSchema = new mongoose.Schema({
  host: { type: String, required: true },
  players: { type: [JugadorRefSchema], default: [] },
  status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
  currentRound: { type: Number, default: 1 },
  maxRounds: { type: Number, default: 3 },
  roundTime: { type: Number, default: 60 },
  currentDrawerIndex: { type: Number, default: 0 },
  currentWord: { type: String, default: '' },
  roundEndsAt: { type: Date, default: null },
  guessedPlayers: { type: [String], default: [] },
  lastWinner: { type: String, default: '' },
  lastMessage: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Partida', PartidaSchema);
