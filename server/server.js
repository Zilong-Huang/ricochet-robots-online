const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Game state
let players = [];
let gameState = {
  board: null,
  robots: [],
  currentGoal: null,
  currentBid: null,
  timer: null,
  isGameStarted: false,
  currentRound: 0,
  maxRounds: 16, // 4 colors * 4 shapes
  moves: [],
  activePlayer: null,
  biddingPhase: true,
  skipVotes: {},
  endBidVotes: {}
};

// Quadrant data
const quadrants = {
  Q1A: [
    'NW,N,N,N,NE,NW,N,N',
    'W,S,X,X,X,X,SEYH,W',
    'WE,NWGT,X,X,X,X,N,X',
    'W,X,X,X,X,X,X,X',
    'W,X,X,X,X,X,S,X',
    'SW,X,X,X,X,X,NEBQ,W',
    'NW,X,E,SWRC,X,X,X,S',
    'W,X,X,N,X,X,E,NW'
  ],
  Q1B: [
    'NW,NE,NW,N,NS,N,N,N',
    'W,S,X,E,NWRC,X,X,X',
    'W,NEGT,W,X,X,X,X,X',
    'W,X,X,X,X,X,SEYH,W',
    'W,X,X,X,X,X,N,X',
    'SW,X,X,X,X,X,X,X',
    'NW,X,E,SWBQ,X,X,X,S',
    'W,X,X,N,X,X,E,NW'
  ],
  Q2A: [
    'NW,N,N,NE,NW,N,N,N',
    'W,X,X,X,X,E,SWBC,X',
    'W,S,X,X,X,X,N,X',
    'W,NEYT,W,X,X,S,X,X',
    'W,X,X,X,E,NWGQ,X,X',
    'W,X,SERH,W,X,X,X,X',
    'SW,X,N,X,X,X,X,S',
    'NW,X,X,X,X,X,E,NW'
  ],
  Q2B: [
    'NW,N,N,N,NE,NW,N,N',
    'W,X,SERH,W,X,X,X,X',
    'W,X,N,X,X,X,X,X',
    'WE,SWGQ,X,X,X,X,S,X',
    'SW,N,X,X,X,E,NWYT,X',
    'NW,X,X,X,X,S,X,X',
    'W,X,X,X,X,NEBC,W,S',
    'W,X,X,X,X,X,E,NW'
  ],
  Q3A: [
    'NW,N,N,NE,NW,N,N,N',
    'W,X,X,X,X,SEGH,W,X',
    'WE,SWRQ,X,X,X,N,X,X',
    'SW,N,X,X,X,X,S,X',
    'NW,X,X,X,X,E,NWYC,X',
    'W,X,S,X,X,X,X,X',
    'W,X,NEBT,W,X,X,X,S',
    'W,X,X,X,X,X,E,NW'
  ],
  Q3B: [
    'NW,N,NS,N,NE,NW,N,N',
    'W,E,NWYC,X,X,X,X,X',
    'W,X,X,X,X,X,X,X',
    'W,X,X,X,X,E,SWBT,X',
    'SW,X,X,X,S,X,N,X',
    'NW,X,X,X,NERQ,W,X,X',
    'W,SEGH,W,X,X,X,X,S',
    'W,N,X,X,X,X,E,NW'
  ],
  Q4A: [
    'NW,N,N,NE,NW,N,N,N',
    'W,X,X,X,X,X,X,X',
    'W,X,X,X,X,SEBH,W,X',
    'W,X,S,X,X,N,X,X',
    'SW,X,NEGC,W,X,X,X,X',
    'NW,S,X,X,X,X,E,SWRT',
    'WE,NWYQ,X,X,X,X,X,NS',
    'W,X,X,X,X,X,E,NW'
  ],
  Q4B: [
    'NW,N,N,NE,NW,N,N,N',
    'WE,SWRT,X,X,X,X,S,X',
    'W,N,X,X,X,X,NEGC,W',
    'W,X,X,X,X,X,X,X',
    'W,X,SEBH,W,X,X,X,S',
    'SW,X,N,X,X,X,E,NWYQ',
    'NW,X,X,X,X,X,X,S',
    'W,X,X,X,X,X,E,NW'
  ]
};

// Helper function to rotate a quadrant
function rotateQuadrant(quadrant) {
  const rotated = [];
  for (let i = 0; i < 8; i++) {
    let newRow = '';
    for (let j = 7; j >= 0; j--) {
      let cell = quadrant[j].split(',')[i];
      cell = cell.replace(/N|E|S|W/g, match => 'ESWN'['NESW'.indexOf(match)]);
      newRow += (newRow ? ',' : '') + cell.split('').sort().join('');
    }
    rotated.push(newRow);
  }
  return rotated;
}

function generateBoard() {
  const board = [];
  const quadrantKeys = Object.keys(quadrants);
  const selectedQuadrants = [];

  // Select and rotate quadrants
  for (let i = 0; i < 4; i++) {
    const randomKey = quadrantKeys[Math.floor(Math.random() * quadrantKeys.length)];
    let quadrant = quadrants[randomKey];
    
    // Rotate based on quadrant position
    switch(i) {
      case 0: // Top-left: no rotation
        break;
      case 1: // Top-right: 1 clockwise rotation
        quadrant = rotateQuadrant(quadrant);
        break;
      case 2: // Bottom-left: 3 clockwise rotations (or 1 counter-clockwise)
        quadrant = rotateQuadrant(rotateQuadrant(rotateQuadrant(quadrant)));
        break;
      case 3: // Bottom-right: 2 clockwise rotations
        quadrant = rotateQuadrant(rotateQuadrant(quadrant));
        break;
    }
    
    selectedQuadrants.push(quadrant);
  }

  // Combine rotated quadrants into the full board
  for (let i = 0; i < 16; i++) {
    const row = [];
    for (let j = 0; j < 16; j++) {
      const quadrantIndex = (Math.floor(i / 8) * 2) + Math.floor(j / 8);
      const cellValue = selectedQuadrants[quadrantIndex][i % 8].split(',')[j % 8];
      row.push(cellValue);
    }
    board.push(row);
  }

  // Add central squares
  board[7][7] = 'BLOCKED';
  board[7][8] = 'BLOCKED';
  board[8][7] = 'BLOCKED';
  board[8][8] = 'BLOCKED';

  return board;
}

// Helper function to place robots randomly
function placeRobots(board) {
  const colors = ['red', 'blue', 'green', 'yellow'];
  const robots = [];

  for (const color of colors) {
    let x, y;
    do {
      x = Math.floor(Math.random() * 16);
      y = Math.floor(Math.random() * 16);
    } while (board[y][x] === 'BLOCKED' || robots.some(robot => robot.x === x && robot.y === y));

    robots.push({ color, x, y });
  }

  return robots;
}

// Helper function to generate the next goal
function generateNextGoal(board, robots, previousGoals) {
  const colors = ['R', 'B', 'G', 'Y'];
  const shapes = ['C', 'T', 'Q', 'H'];
  let goals = [];

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const cell = board[y][x];
      if (cell.length > 2) {
        const color = cell[cell.length - 2];
        const shape = cell[cell.length - 1];
        if (colors.includes(color) && shapes.includes(shape)) {
          goals.push({ color, shape, x, y });
        }
      }
    }
  }

  // Filter out the current goal (if any)
  goals = goals.filter(goal => 
    !previousGoals.some(prev => 
      prev.color === goal.color && prev.shape === goal.shape && prev.x === goal.x && prev.y === goal.y
    )
  );

  if (goals.length === 0) {
    // All goals have been used, end the game
    return null;
  }

  return goals[Math.floor(Math.random() * goals.length)];
}

// Helper function to validate a move
function isValidMove(board, robots, move) {
  const robot = robots.find(r => r.color === move.color);
  let { x, y } = robot;
  const dx = move.direction === 'left' ? -1 : move.direction === 'right' ? 1 : 0;
  const dy = move.direction === 'up' ? -1 : move.direction === 'down' ? 1 : 0;
  let hasMoved = false;

  while (true) {
    const newX = x + dx;
    const newY = y + dy;

    if (newX < 0 || newX >= 16 || newY < 0 || newY >= 16) break;
    if (board[newY][newX] === 'BLOCKED') break;
    if (robots.some(r => r.x === newX && r.y === newY)) break;

    const cell = board[newY][newX];
    if ((dx === -1 && cell.includes('E')) ||
        (dx === 1 && cell.includes('W')) ||
        (dy === -1 && cell.includes('S')) ||
        (dy === 1 && cell.includes('N'))) {
      break;
    }

    x = newX;
    y = newY;
    hasMoved = true;
  }

  return hasMoved ? { x, y } : null;
}

// Helper function to check if the solution is correct
function checkSolution(board, initialRobots, moves, goal) {
  let robots = JSON.parse(JSON.stringify(initialRobots));
  let hasRicocheted = false;

  for (const move of moves) {
    const robotIndex = robots.findIndex(r => r.color === move.color);
    const newPosition = isValidMove(board, robots, move);
    
    if (!newPosition) return false; // Invalid move

    if (newPosition.x !== robots[robotIndex].x || newPosition.y !== robots[robotIndex].y) {
      hasRicocheted = true;
    }

    robots[robotIndex] = { ...robots[robotIndex], ...newPosition };
  }

  const targetRobot = robots.find(r => r.color[0].toUpperCase() === goal.color);
  return hasRicocheted && targetRobot.x === goal.x && targetRobot.y === goal.y;
}

io.on('connection', (socket) => {
  console.log('New client connected');

  // Join lobby
  socket.on('join_lobby', (username) => {
    if (players.some(p => p.username === username)) {
      socket.emit('username_taken');
      return;
    }

    const player = {
      id: socket.id,
      username,
      score: 0
    };
    players.push(player);
    socket.emit('lobby_joined', player);
    io.emit('update_players', players);

    // If game is in progress, send current game state to the new player
    if (gameState.isGameStarted) {
      socket.emit('game_in_progress', gameState);
    }
  });

  // Start game
  socket.on('start_game', () => {
    if (!gameState.isGameStarted) {
      gameState.board = generateBoard();
      gameState.robots = placeRobots(gameState.board);
      gameState.currentGoal = generateNextGoal(gameState.board, gameState.robots, []);
      gameState.currentBid = null;
      gameState.timer = null;
      gameState.isGameStarted = true;
      gameState.currentRound = 1;
      gameState.moves = [];
      gameState.activePlayer = null;
      gameState.biddingPhase = true;
      io.emit('game_started', gameState);
    }
  });

  // Place bid
  socket.on('place_bid', (bid) => {
    if (gameState.biddingPhase && (gameState.currentBid === null || bid < gameState.currentBid.value)) {
      gameState.currentBid = { playerId: socket.id, value: bid };
      if (gameState.timer === null) {
        gameState.timer = 60; // 60 seconds timer
        const countdown = setInterval(() => {
          gameState.timer--;
          io.emit('update_timer', gameState.timer);
          if (gameState.timer <= 0) {
            clearInterval(countdown);
            gameState.biddingPhase = false;
            io.emit('bidding_phase_ended', gameState.currentBid);
            gameState.activePlayer = gameState.currentBid.playerId;
            io.emit('prove_solution', gameState.activePlayer);
          }
        }, 1000);
      }
      io.emit('update_bid', gameState.currentBid);
    }
  });

  // Prove solution
  socket.on('move_robot', (move) => {
    if (socket.id !== gameState.activePlayer || gameState.biddingPhase) return;

    const newPosition = isValidMove(gameState.board, gameState.robots, move);
    if (newPosition) {
      const robotIndex = gameState.robots.findIndex(r => r.color === move.color);
      gameState.robots[robotIndex] = { ...gameState.robots[robotIndex], ...newPosition };
      gameState.moves.push(move);
      io.emit('update_game_state', gameState);

      if (gameState.moves.length === gameState.currentBid.value) {
        const isValid = checkSolution(gameState.board, gameState.robots, gameState.moves, gameState.currentGoal);
        const playerIndex = players.findIndex(p => p.id === socket.id);
        
        if (isValid) {
          players[playerIndex].score++;
          io.emit('solution_result', { playerId: socket.id, isValid, score: players[playerIndex].score });
          startNextRound();
        } else {
          players[playerIndex].score = Math.max(0, players[playerIndex].score - 1);
          io.emit('solution_result', { playerId: socket.id, isValid, score: players[playerIndex].score });
          startNextRound();
        }
        
        io.emit('update_players', players);
      }
    }
  });

  socket.on('vote_skip', () => {
    if (!gameState.skipVotes[socket.id]) {
      gameState.skipVotes[socket.id] = true;
      io.emit('update_skip_votes', gameState.skipVotes);

      if (Object.keys(gameState.skipVotes).length === players.length) {
        // All players voted to skip
        gameState.currentGoal = generateNextGoal(gameState.board, gameState.robots, [gameState.currentGoal]);
        gameState.skipVotes = {};
        gameState.currentBid = null;
        gameState.timer = null;
        gameState.moves = [];
        gameState.activePlayer = null;
        gameState.biddingPhase = true;

        if (gameState.currentGoal === null) {
          // No more goals available, end the game
          io.emit('game_over', players.sort((a, b) => b.score - a.score));
        } else {
          io.emit('new_round', gameState);
        }
      }
    }
  });

  socket.on('vote_end_bid', () => {
    if (!gameState.endBidVotes[socket.id] && gameState.currentBid) {
      gameState.endBidVotes[socket.id] = true;
      io.emit('update_end_bid_votes', gameState.endBidVotes);

      if (Object.keys(gameState.endBidVotes).length === players.length) {
        // All players voted to end bidding
        gameState.biddingPhase = false;
        gameState.activePlayer = gameState.currentBid.playerId;
        gameState.endBidVotes = {};
        io.emit('prove_solution', gameState.activePlayer);
      }
    }
  });

  // Chat message
  socket.on('chat_message', (message) => {
    io.emit('chat_message', { playerId: socket.id, message });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    players = players.filter(p => p.id !== socket.id);
    io.emit('update_players', players);

    // If no players left, reset the game
    if (players.length === 0) {
      gameState.isGameStarted = false;
      gameState.currentRound = 0;
    }
  });
});

function startNextRound() {
  gameState.currentRound++;
  if (gameState.currentRound > gameState.maxRounds) {
    io.emit('game_over', players.sort((a, b) => b.score - a.score));
  } else {
    gameState.currentGoal = generateNextGoal(gameState.board, gameState.robots, [gameState.currentGoal]);
    if (gameState.currentGoal === null) {
      // No more goals available, end the game
      io.emit('game_over', players.sort((a, b) => b.score - a.score));
    } else {
      gameState.currentBid = null;
      gameState.timer = null;
      gameState.moves = [];
      gameState.activePlayer = null;
      gameState.biddingPhase = true;
      gameState.skipVotes = {};
      gameState.endBidVotes = {};
      io.emit('new_round', gameState);
    }
  }
}

function resetRobots() {
  gameState.robots = placeRobots(gameState.board);
  gameState.moves = [];
  io.emit('update_game_state', gameState);
}

function tryNextBidder() {
  const sortedBids = players
    .map(player => ({ playerId: player.id, value: player.lastBid, score: player.score }))
    .filter(bid => bid.value !== undefined && bid.playerId !== gameState.activePlayer)
    .sort((a, b) => a.value - b.value || a.score - b.score);

  if (sortedBids.length > 0) {
    gameState.currentBid = sortedBids[0];
    gameState.activePlayer = sortedBids[0].playerId;
    io.emit('prove_solution', gameState.activePlayer);
  } else {
    startNextRound();
  }
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));