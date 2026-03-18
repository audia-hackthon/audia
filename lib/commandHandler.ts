import { 
  scrollDown, scrollUp, goToTop, goToBottom, 
  navigateToSection, searchForKeyword, extractPageText, getVisibleText 
} from './domActions';
import { playMurfAudio } from './murfVoice';

type CommandResult = {
  replied: boolean;
  message?: string;
};

export const processCommand = async (command: string, setTranscript: (msg: string) => void): Promise<CommandResult> => {
  const normalized = command.toLowerCase().trim();
  console.log('Processing command:', normalized);

  setTranscript(normalized);

  // 1. Navigation Commands
  if (normalized.includes('scroll down')) {
    scrollDown();
    await playMurfAudio('Scrolling down.');
    return { replied: true };
  }
  
  if (normalized.includes('scroll up')) {
    scrollUp();
    await playMurfAudio('Scrolling up.');
    return { replied: true };
  }

  if (normalized.includes('go to top')) {
    goToTop();
    await playMurfAudio('Going to the top.');
    return { replied: true };
  }

  if (normalized.includes('go to bottom')) {
    goToBottom();
    await playMurfAudio('Going to the bottom.');
    return { replied: true };
  }

  // 2. Page Navigation e.g., "go to pricing"
  const goToMatch = normalized.match(/go to (.+)/);
  if (goToMatch) {
    const section = goToMatch[1].trim();
    const found = navigateToSection(section);
    if (found) {
      await playMurfAudio(`Navigating to ${section}.`);
    } else {
      await playMurfAudio(`I couldn't find a section for ${section}.`);
    }
    return { replied: true };
  }

  // 3. Search Commands e.g., "search for productivity tools"
  const searchMatch = normalized.match(/search for (.+)/);
  if (searchMatch) {
    const keyword = searchMatch[1].trim();
    const found = searchForKeyword(keyword);
    if (found) {
      await playMurfAudio(`Found result for ${keyword}.`);
    } else {
      await playMurfAudio(`I couldn't find ${keyword} on this page.`);
    }
    return { replied: true };
  }

  // 4. AI Commands
  if (normalized.includes('summarize this page')) {
    await playMurfAudio('Hold on, summarizing the page for you.');
    setTranscript('Summarizing page...');
    try {
      const pageText = extractPageText();
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pageText })
      });
      const data = await res.json();
      
      if (data.summary) {
        setTranscript(`Summary: ${data.summary}`);
        await playMurfAudio(data.summary);
      } else {
        await playMurfAudio('Sorry, I failed to summarize the page.');
      }
    } catch (e) {
      await playMurfAudio('There was an error summarizing the page.');
    }
    return { replied: true };
  }

  if (normalized.includes('explain this section')) {
    await playMurfAudio('Let me explain what is currently on your screen.');
    setTranscript('Explaining section...');
    try {
      const visibleText = getVisibleText();
      if (!visibleText || visibleText.length < 10) {
        await playMurfAudio('There is not much text visible on the screen to explain.');
        return { replied: true };
      }

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: visibleText })
      });
      const data = await res.json();

      if (data.explanation) {
        setTranscript(`Explanation: ${data.explanation}`);
        await playMurfAudio(data.explanation);
      } else {
        await playMurfAudio('Sorry, I could not explain this section.');
      }
    } catch (e) {
      await playMurfAudio('There was an error generating the explanation.');
    }
    return { replied: true };
  }

  // Default response if command is not recognized
  await playMurfAudio("I'm sorry, I didn't understand the command.");
  return { replied: true };
};
