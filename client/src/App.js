import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import styled from 'styled-components';

const socket = io('http://localhost:3001');

const AppContainer = styled.div`
  display: flex;
  font-family: 'Roboto', sans-serif;
  height: 100vh;
  background-color: #f0f0f0;
`;

const LeftSidebar = styled.div`
  width: 300px;
  padding: 20px;
  background-color: #ffffff;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
`;

const RightSidebar = styled.div`
  width: 250px;
  padding: 20px;
  background-color: #ffffff;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
`;

const GameArea = styled.div`
  flex-grow: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
`;

const Board = styled.div`
  display: grid;
  grid-template-columns: repeat(16, 30px);
  grid-template-rows: repeat(16, 30px);
  gap: 1px;
  background-color: #ccc;
  padding: 5px;
  margin-bottom: 20px;
`;

const Cell = styled.div`
  width: 30px;
  height: 30px;
  background-color: ${props => props.isBlocked ? '#333' : '#fff'};
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  position: relative;
  box-sizing: border-box;

  ${props => props.walls.includes('N') && 'border-top: 2px solid #000;'}
  ${props => props.walls.includes('E') && 'border-right: 2px solid #000;'}
  ${props => props.walls.includes('S') && 'border-bottom: 2px solid #000;'}
  ${props => props.walls.includes('W') && 'border-left: 2px solid #000;'}
`;

const Robot = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: ${props => props.color};
  position: absolute;
  top: 5px;
  left: 5px;
  border: 2px solid black;
  box-shadow: 0 0 0 2px white;
`;

const Goal = styled.div`
  width: 20px;
  height: 20px;
  background-color: ${props => props.color};
  clip-path: ${props => {
    switch (props.shape) {
      case 'C': return 'circle(50% at 50% 50%)';
      case 'T': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
      case 'Q': return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      case 'H': return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
      default: return 'none';
    }
  }};
  position: absolute;
  top: 5px;
  left: 5px;
`;

const Button = styled.button`
  margin: 5px;
  padding: 10px;
  font-size: 16px;
  cursor: pointer;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  &:hover {
    background-color: #45a049;
  }
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const Input = styled.input`
  margin: 5px;
  padding: 5px;
  font-size: 16px;
`;

const ChatContainer = styled.div`
  flex-grow: 1;
  border: 1px solid #ccc;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
`;

const ChatMessages = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding: 10px;
`;

const ChatInput = styled.div`
  display: flex;
  padding: 10px;
`;

const Rules = styled.div`
  margin-bottom: 20px;
  font-size: 14px;
`;

const TimerDisplay = styled.div`
  font-size: 36px;
  font-weight: bold;
  text-align: center;
  margin: 20px 0;
`;

const GameInfoBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f0f0f0;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
`;

const BidSection = styled.div`
  display: flex;
  align-items: center;
  background-color: #e6f7ff;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 20px;
`;

const CurrentBid = styled.div`
  font-size: 18px;
  font-weight: bold;
  margin-right: 20px;
`;

const VoteButton = styled(Button)`
  background-color: #ffa500;
  &:hover {
    background-color: #ff8c00;
  }
`;

const Leaderboard = styled.div`
  background-color: #f8f8f8;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
`;

const LeaderboardTitle = styled.h2`
  font-size: 24px;
  margin-bottom: 15px;
  text-align: center;
`;

const LeaderboardEntry = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 16px;
  padding: 5px 0;
  border-bottom: 1px solid #e0e0e0;

  &:last-child {
    border-bottom: none;
  }
`;

const Username = styled.span`
  font-weight: ${props => props.isCurrentPlayer ? 'bold' : 'normal'};
  color: ${props => props.isCurrentPlayer ? '#4CAF50' : 'inherit'};
`;

const Score = styled.span`
  font-weight: bold;
`;
  
  function App() {
    const [username, setUsername] = useState('');
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentBid, setCurrentBid] = useState(null);
    const [isUsernameSet, setIsUsernameSet] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [bidValue, setBidValue] = useState('');
    const [isBiddingPhase, setIsBiddingPhase] = useState(true);
    const [skipVotes, setSkipVotes] = useState({});
    const [endBidVotes, setEndBidVotes] = useState({});

    useEffect(() => {
      socket.on('update_players', (updatedPlayers) => {
        setPlayers(updatedPlayers);
      });

      socket.on('game_started', (newGameState) => {
        setGameState(newGameState);
        setIsBiddingPhase(true);
      });

      socket.on('update_bid', (bid) => {
        setCurrentBid(bid);
      });

      socket.on('update_timer', (time) => {
        setGameState(prev => ({ ...prev, timer: time }));
      });

      socket.on('time_up', () => {
        alert('Time is up! The player with the lowest bid must now prove their solution.');
      });

      socket.on('prove_solution', (playerId) => {
        setIsBiddingPhase(false);
        setGameState(prev => ({ ...prev, activePlayer: playerId }));
        if (playerId === socket.id) {
          alert('It\'s your turn to prove your solution! Use the controls to move the robots.');
        }
      });

      socket.on('new_round', (newGameState) => {
        setGameState(newGameState);
        setCurrentBid(null);
        setIsBiddingPhase(true);
      });

      socket.on('update_game_state', (updatedGameState) => {
        setGameState(updatedGameState);
      });

      socket.on('chat_message', (message) => {
        setChatMessages(prev => [...prev, message]);
      });

      socket.on('solution_result', ({ playerId, isValid, score }) => {
        const playerName = players.find(p => p.id === playerId)?.username;
        alert(`${playerName}'s solution is ${isValid ? 'valid' : 'invalid'}. Their score is now ${score}.`);
        setIsBiddingPhase(true);
      });

      socket.on('game_over', (finalPlayers) => {
        const winner = finalPlayers[0];
        alert(`Game over! The winner is ${winner.username} with a score of ${winner.score}!`);
        setGameState(null);
        setIsBiddingPhase(true);
      });

      socket.on('lobby_joined', (player) => {
        setCurrentPlayer(player);
        setIsUsernameSet(true);
      });

      socket.on('username_taken', () => {
        alert('This username is already taken. Please choose another one.');
      });

      socket.on('bidding_phase_ended', (finalBid) => {
        setIsBiddingPhase(false);
        setCurrentBid(finalBid);
      });

      socket.on('game_in_progress', (currentGameState) => {
        setGameState(currentGameState);
        setIsBiddingPhase(currentGameState.biddingPhase);
      });

      socket.on('update_skip_votes', (votes) => {
        setSkipVotes(votes);
      });
  
      socket.on('update_end_bid_votes', (votes) => {
        setEndBidVotes(votes);
      });
  
      return () => {
        socket.off('update_players');
        socket.off('game_started');
        socket.off('update_bid');
        socket.off('update_timer');
        socket.off('game_in_progress');
        socket.off('time_up');
        socket.off('prove_solution');
        socket.off('new_round');
        socket.off('update_game_state');
        socket.off('chat_message');
        socket.off('solution_result');
        socket.off('game_over');
        socket.off('lobby_joined');
        socket.off('username_taken');
        socket.off('bidding_phase_ended');
        socket.off('update_skip_votes');
        socket.off('update_end_bid_votes');
      };
    }, [players]);
  
    const joinLobby = () => {
      if (username && !isUsernameSet) {
        socket.emit('join_lobby', username);
      }
    };

    const voteSkip = () => {
      socket.emit('vote_skip');
    };
  
    const voteEndBid = () => {
      socket.emit('vote_end_bid');
    };
  
    const startGame = () => {
      socket.emit('start_game');
    };
  
    const placeBid = () => {
      if (bidValue && !isNaN(bidValue)) {
        socket.emit('place_bid', parseInt(bidValue));
        setBidValue('');
      }
    };
  
    const moveRobot = (color, direction) => {
      socket.emit('move_robot', { color, direction });
    };
  
    const sendChatMessage = () => {
      if (currentMessage) {
        socket.emit('chat_message', currentMessage);
        setCurrentMessage('');
      }
    };

    const handleChatKeyPress = (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    };
  
    const renderBoard = () => {
      if (!gameState || !gameState.board) return null;
  
      return (
        <Board>
          {gameState.board.map((row, y) =>
            row.map((cell, x) => (
              <Cell
                key={`${x}-${y}`}
                isBlocked={cell === 'BLOCKED'}
                walls={cell.split('')}
              >
                {gameState.robots.map(robot => 
                  robot.x === x && robot.y === y ? (
                    <Robot key={robot.color} color={robot.color} />
                  ) : null
                )}
                {gameState.currentGoal && gameState.currentGoal.x === x && gameState.currentGoal.y === y && (
                  <Goal color={gameState.currentGoal.color === 'R' ? 'red' : 
                              gameState.currentGoal.color === 'B' ? 'blue' :
                              gameState.currentGoal.color === 'G' ? 'green' : 'yellow'} 
                        shape={gameState.currentGoal.shape} />
                )}
              </Cell>
            ))
          )}
        </Board>
      );
    };
  
    const renderControls = () => {
      const colors = ['red', 'blue', 'green', 'yellow'];
      const directions = ['up', 'down', 'left', 'right'];
    
      const isActivePlayer = gameState && gameState.activePlayer === socket.id;
      const canMove = !isBiddingPhase && isActivePlayer;
    
      return (
        <div>
          <h3>Prove Your Solution</h3>
          {colors.map(color => (
            <div key={color}>
              {directions.map(direction => (
                <Button 
                  key={`${color}-${direction}`} 
                  onClick={() => moveRobot(color, direction)}
                  disabled={!canMove}
                >
                  Move {color} {direction}
                </Button>
              ))}
            </div>
          ))}
        </div>
      );
    };
  
    return (
      <AppContainer>
        <LeftSidebar>
          <Rules>
            <h3>Welcome to Ricochet Robots Online!</h3>
            <p>
              Guide robots to their goals on a 16x16 board. Bid the lowest move count to solve the puzzle.
              Succeed and gain a point, fail and lose one. Good luck!
            </p>
          </Rules>
          {isUsernameSet && (
            <ChatContainer>
              <ChatMessages>
                {chatMessages.map((msg, index) => (
                  <div key={index}>
                    <strong>{players.find(p => p.id === msg.playerId)?.username}:</strong> {msg.message}
                  </div>
                ))}
              </ChatMessages>
              <ChatInput>
                <Input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  placeholder="Type a message"
                />
                <Button onClick={sendChatMessage}>Send</Button>
              </ChatInput>
            </ChatContainer>
          )}
        </LeftSidebar>
  
        <GameArea>
          {!isUsernameSet ? (
            <div className="username-input">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
              <Button onClick={joinLobby}>Join Lobby</Button>
            </div>
          ) : !gameState ? (
            <div className="lobby">
              <h2>Welcome, {currentPlayer.username}!</h2>
              <Button onClick={startGame}>Start Game</Button>
              <div>
                <h3>Players in Lobby: {players.length}</h3>
                {players.map((player) => (
                  <div key={player.id}>{player.username}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="game-board">
            <TimerDisplay>{gameState.timer !== null ? gameState.timer : 'No timer active'}</TimerDisplay>
            <GameInfoBar>
              <div>Round: {gameState.currentRound} / {gameState.maxRounds}</div>
              {gameState.currentGoal && (
                <div>
                  Current Goal: 
                  {gameState.currentGoal.color === 'R' ? 'Red' : 
                   gameState.currentGoal.color === 'B' ? 'Blue' : 
                   gameState.currentGoal.color === 'G' ? 'Green' : 'Yellow'} 
                   &nbsp;Robot to {gameState.currentGoal.color === 'R' ? 'Red' : 
                   gameState.currentGoal.color === 'B' ? 'Blue' : 
                   gameState.currentGoal.color === 'G' ? 'Green' : 'Yellow'} {gameState.currentGoal.shape === 'C' ? 'Circle' : 
                            gameState.currentGoal.shape === 'T' ? 'Triangle' : 
                            gameState.currentGoal.shape === 'Q' ? 'Square' : 'Hexagon'}
                </div>
              )}
              <div>Moves: {gameState.moves?.length || 0} / {currentBid ? currentBid.value : '-'}</div>
              <div>Current Phase: {isBiddingPhase ? 'Bidding' : 'Proving Solution'}</div>
              <div>Active Player: {players.find(p => p.id === gameState.activePlayer)?.username || 'None'}</div>
            </GameInfoBar>

            <BidSection>
              <CurrentBid>Current Bid: {currentBid ? `${currentBid.value} by ${players.find(p => p.id === currentBid.playerId)?.username}` : 'None'}</CurrentBid>
              {isBiddingPhase && (
                <>
                  <Input
                    type="number"
                    value={bidValue}
                    onChange={(e) => setBidValue(e.target.value)}
                    placeholder="Enter your bid"
                  />
                  <Button onClick={placeBid} disabled={!bidValue || isNaN(bidValue)}>Confirm Bid</Button>
                </>
              )}
            </BidSection>

            {renderBoard()}
            {renderControls()}

            <div>
              <VoteButton onClick={voteSkip}>Vote to Skip ({Object.keys(skipVotes).length} / {players.length})</VoteButton>
              <VoteButton onClick={voteEndBid}>Vote to End Bidding ({Object.keys(endBidVotes).length} / {players.length})</VoteButton>
            </div>
          </div>
        )}
      </GameArea>
  
      <RightSidebar>
        <Leaderboard>
          <LeaderboardTitle>Leaderboard</LeaderboardTitle>
          {players.sort((a, b) => b.score - a.score).map((player, index) => (
            <LeaderboardEntry key={player.id}>
              <Username isCurrentPlayer={player.id === currentPlayer?.id}>
                {index + 1}. {player.username}
              </Username>
              <Score>{player.score}</Score>
            </LeaderboardEntry>
          ))}
        </Leaderboard>
      </RightSidebar>
    </AppContainer>
  );
}
  
  export default App;