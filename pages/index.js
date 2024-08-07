import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import NextImage from 'next/image';
import styles from '../styles/Home.module.css';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';

const GRAVITY = 0.6;
const JUMP_FORCE = -15;
const FLOOR_HEIGHT = 50;
const INITIAL_SPEED = 3;
const SPEED_INCREASE_INTERVAL = 10000; // 10 seconds

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [gameSpeed, setGameSpeed] = useState(INITIAL_SPEED);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [isLandscape, setIsLandscape] = useState(true);
  const canvasRef = useRef(null);
  const playerRef = useRef({ x: 50, y: 300, velocityY: 0, jumps: 0 });
  const coinsRef = useRef([]);
  const barriersRef = useRef([]);
  const gameSpeedRef = useRef(INITIAL_SPEED);
  const gameTimeRef = useRef(0);

  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(800, window.innerWidth - 20);
      const height = width / 2;
      setCanvasSize({ width, height });
    };

    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        setIsLandscape(window.innerWidth > window.innerHeight);
      }
    };

    handleResize();
    checkOrientation();
    window.addEventListener('resize', handleResize);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const fetchHighScores = async () => {
    console.log('Fetching high scores...');
    const { data, error } = await supabase
      .from('high_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(50);
    if (data) {
      console.log('High scores fetched:', data);
      setHighScores(data);
    }
    if (error) console.error('Error fetching high scores:', error);
  };

  useEffect(() => {
    fetchHighScores();
    
    const checkSupabaseConnection = async () => {
      const { data, error } = await supabase.from('high_scores').select('count', { count: 'exact' });
      if (error) {
        console.error('Supabase connection error:', error);
      } else {
        console.log('Supabase connected successfully. Row count:', data);
      }
    };
    checkSupabaseConnection();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStarted && e.code === 'Space') {
        e.preventDefault();
        jump();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameStarted]);

  useEffect(() => {
    if (gameStarted && isLandscape) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      let animationFrameId;

      const player = new Image();
      player.src = '/player.png';
      const coin = new Image();
      coin.src = '/coin.png';
      const barrier = new Image();
      barrier.src = '/barrier.png';

      const gameLoop = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Update player position and apply gravity
        playerRef.current.velocityY += GRAVITY;
        playerRef.current.y += playerRef.current.velocityY;

        // Keep player on the floor and reset jumps
        if (playerRef.current.y > canvas.height - FLOOR_HEIGHT - 50) {
          playerRef.current.y = canvas.height - FLOOR_HEIGHT - 50;
          playerRef.current.velocityY = 0;
          playerRef.current.jumps = 0;
        }

        // Draw player in a circle
        const playerSize = Math.min(50, canvas.width / 16);
        ctx.save();
        ctx.beginPath();
        ctx.arc(playerRef.current.x + playerSize/2, playerRef.current.y + playerSize/2, playerSize/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(player, playerRef.current.x, playerRef.current.y, playerSize, playerSize);
        ctx.restore();

        // Draw floor
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, canvas.height - FLOOR_HEIGHT, canvas.width, FLOOR_HEIGHT);

        // Draw coins
        const coinSize = Math.min(30, canvas.width / 26);
        coinsRef.current.forEach((coinPos) => {
          ctx.drawImage(coin, coinPos.x, coinPos.y, coinSize, coinSize);
        });

        // Draw barriers
        const barrierWidth = Math.min(30, canvas.width / 26);
        barriersRef.current.forEach((barrierPos) => {
          ctx.drawImage(barrier, barrierPos.x, barrierPos.y, barrierWidth, barrierPos.height);
        });

        // Move barriers and coins
        barriersRef.current = barriersRef.current.map((b) => ({ ...b, x: b.x - gameSpeedRef.current })).filter((b) => b.x > -100);
        coinsRef.current = coinsRef.current.map((c) => ({ ...c, x: c.x - gameSpeedRef.current })).filter((c) => c.x > -30);

        // Spawn new barriers and coins
        if (Math.random() < 0.01) {
          spawnBarrier();
        }
        if (Math.random() < 0.05 || coinsRef.current.length < 3) {
          spawnCoin();
        }

        // Collision detection and score update
        coinsRef.current = coinsRef.current.filter((coin) => {
          if (Math.abs(coin.x - playerRef.current.x) < 40 && Math.abs(coin.y - playerRef.current.y) < 40) {
            setScore((prevScore) => prevScore + 1);
            return false;
          }
          return true;
        });

        // Check for game over
        if (checkCollision()) {
          console.log('Game Over! Final Score:', score);
          endGame();
          return;
        }

        // Increase game speed
        gameTimeRef.current += 16; // Assuming 60 FPS
        if (gameTimeRef.current % SPEED_INCREASE_INTERVAL < 16) {
          gameSpeedRef.current += 0.5;
          setGameSpeed(gameSpeedRef.current);
        }

        // Draw score and speed
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(16, canvas.width / 50)}px Arial`;
        ctx.fillText(`Score: ${score}`, 10, 30);
        ctx.fillText(`Speed: ${gameSpeedRef.current.toFixed(1)}`, canvas.width - 120, 30);

        animationFrameId = requestAnimationFrame(gameLoop);
      };

      gameLoop();

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [gameStarted, score, canvasSize, isLandscape]);

  const startGame = () => {
    if (playerName.trim() === '') {
      alert('Please enter your Twitter handle before starting the game.');
      return;
    }
    setGameStarted(true);
    setScore(0);
    playerRef.current = { x: 50, y: canvasSize.height - FLOOR_HEIGHT - 50, velocityY: 0, jumps: 0 };
    coinsRef.current = [];
    barriersRef.current = [];
    gameSpeedRef.current = INITIAL_SPEED;
    gameTimeRef.current = 0;
    setGameSpeed(INITIAL_SPEED);
    console.log('Game Started');
  };

  const endGame = useCallback(async () => {
    setGameStarted(false);
    console.log('Saving score:', playerName, score);
    const { data, error } = await supabase
      .from('high_scores')
      .insert([{ name: playerName, score: score }]);
    if (error) {
      console.error('Error saving score:', error);
    } else {
      console.log('Score saved successfully:', data);
    }
    await fetchHighScores();
    confetti();
    console.log('Game Ended. Final Score:', score);
  }, [playerName, score]);

  const jump = () => {
    const isOnGround = playerRef.current.y >= canvasSize.height - FLOOR_HEIGHT - 50;
    
    if (isOnGround || playerRef.current.jumps < 2) {
      playerRef.current.velocityY = JUMP_FORCE;
      playerRef.current.jumps = isOnGround ? 1 : playerRef.current.jumps + 1;
    }
  };

  const handleTouchStart = () => {
    jump();
  };

  const spawnBarrier = () => {
    const difficulty = Math.min(gameTimeRef.current / 120000, 0.7); // Max difficulty after 2 minutes
    const height = 60 + Math.random() * 60 * difficulty; // Height increases with difficulty
    barriersRef.current.push({
      x: canvasSize.width,
      y: canvasSize.height - FLOOR_HEIGHT - height,
      width: Math.min(30, canvasSize.width / 26),
      height: height
    });
  };

  const spawnCoin = () => {
    coinsRef.current.push({
      x: canvasSize.width,
      y: canvasSize.height - FLOOR_HEIGHT - 30 - Math.random() * 100
    });
  };

  const checkCollision = () => {
    return barriersRef.current.some((barrier) => 
      playerRef.current.x + 40 > barrier.x &&
      playerRef.current.x < barrier.x + barrier.width &&
      playerRef.current.y + 40 > barrier.y &&
      playerRef.current.y < barrier.y + barrier.height
    );
  };

  const formatTwitterHandle = (handle) => {
    return handle.startsWith('@') ? handle.slice(1) : handle;
  };
  return (
    <div className={styles.container}>
      <Head>
        <title>Garry Run</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
  
      <main className={styles.main}>
        <h1 className={styles.title}>Garry Run</h1>
  
        {!isLandscape && gameStarted ? (
          <div className={styles.orientationPrompt}>
            <p>Please rotate your device to landscape mode to play the game.</p>
            <div className={styles.rotateIcon}>↻</div>
          </div>
        ) : (
          <>
            {!gameStarted ? (
              <div className={styles.startContainer}>
                <NextImage 
                  src="/garry.png" 
                  alt="Garry" 
                  width={200} 
                  height={200} 
                  className={styles.garryImage}
                />
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your Twitter handle"
                  className={styles.input}
                />
                <button onClick={startGame} className={styles.button}>
                  Start Game
                </button>
              </div>
            ) : (
              <div
                tabIndex={0}
                onTouchStart={handleTouchStart}
                className={styles.gameArea}
              >
                <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} />
                <div>Press Space to jump or touch the screen on mobile</div>
              </div>
            )}
  
            <div className={styles.highScores}>
              <h2>High Scores</h2>
              <div className={styles.scoreList}>
                <ul>
                  {highScores.map((entry, index) => (
                    <li key={index}>
                      <a 
                        href={`https://x.com/${formatTwitterHandle(entry.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {entry.name}
                      </a>: {entry.score}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </main>
  
      <footer className={styles.footer}>
        Made with Claude by <a href="https://x.com/Must_be_Ash" target="_blank" rel="noopener noreferrer">@must_be_Ash</a>
      </footer>
    </div>
  );
}