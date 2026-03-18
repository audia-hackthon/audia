export const scrollDown = () => {
  if (typeof window !== 'undefined') {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  }
};

export const scrollUp = () => {
  if (typeof window !== 'undefined') {
    window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
  }
};

export const goToTop = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

export const goToBottom = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
};

export const navigateToSection = (sectionName: string) => {
  const elements = [
    ...Array.from(document.querySelectorAll('h1, h2, h3, a, button'))
  ] as HTMLElement[];
  
  const target = elements.find(el => 
    el.innerText && el.innerText.toLowerCase().includes(sectionName.toLowerCase())
  );

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Fallback: visually highlight the element
    const originalBackground = target.style.backgroundColor;
    target.style.transition = 'background-color 0.5s';
    target.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
    setTimeout(() => {
      target.style.backgroundColor = originalBackground;
    }, 2000);
    
    return true;
  }
  return false;
};

export const searchForKeyword = (keyword: string) => {
  // Try to find the first occurrence of the keyword in the document text
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while ((node = treeWalker.nextNode())) {
    if (node.nodeValue?.toLowerCase().includes(keyword.toLowerCase())) {
      const parentElement = node.parentElement;
      if (parentElement) {
        parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const originalColor = parentElement.style.color;
        parentElement.style.transition = 'color 0.5s';
        parentElement.style.color = 'blue';
        setTimeout(() => {
          parentElement.style.color = originalColor;
        }, 2000);
        return true;
      }
    }
  }
  return false;
};

export const extractPageText = (): string => {
  if (typeof document === 'undefined') return '';
  // Simple extraction of body text content.
  // We can limit the extraction to main elements to avoid headers/footers in complex sites.
  const main = document.querySelector('main') || document.body;
  
  // Clone the node to remove scripts, styles, etc.
  const clone = main.cloneNode(true) as HTMLElement;
  const unwantedEls = clone.querySelectorAll('script, style, noscript, nav, header, footer');
  unwantedEls.forEach(el => el.remove());
  
  return clone.innerText.substring(0, 5000); // Limit context length
};

export const getVisibleText = (): string => {
  if (typeof window === 'undefined') return '';
  
  // A rough estimate of finding visible elements in the viewport
  const elements = Array.from(document.querySelectorAll('h1, h2, h3, p, li')) as HTMLElement[];
  const visibleElements = elements.filter(el => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth) &&
      el.offsetParent !== null // is relatively visible
    );
  });
  
  const text = visibleElements.map(el => el.innerText).join('\n');
  return text.substring(0, 3000); // Limit context
};
