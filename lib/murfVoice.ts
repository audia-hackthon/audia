export const playMurfAudio = async (text: string, voiceId: string = 'en-US-natalie') => {
  try {
    const response = await fetch('/api/murf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audio from Murf AI');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    
    // Play back
    await audio.play();

    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error playing Murf audio:', error);
    return false;
  }
};
