// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 只处理解析 HTML 的请求
  if (message.action === 'parseHTML') {
    console.log('Offscreen: 收到解析 HTML 请求');
    
    try {
      const { html, word, dictionaryType } = message;
      
      // 在这里我们可以使用 DOMParser，因为这是在普通的网页环境中
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 解析结果对象
      const result = {
        word: word,
        phonetics: {
          uk: '',
          us: ''
        },
        definitions: []
      };
      
      // 提取音标
      try {
        // 提取英式音标
        const ukPronElement = doc.querySelector('.uk.dpron-i .ipa.dipa');
        if (ukPronElement) {
          result.phonetics.uk = ukPronElement.textContent.trim();
          console.log("Offscreen: 找到英式音标:", result.phonetics.uk);
        }
        
        // 提取美式音标
        const usPronElement = doc.querySelector('.us.dpron-i .ipa.dipa');
        if (usPronElement) {
          result.phonetics.us = usPronElement.textContent.trim();
          console.log("Offscreen: 找到美式音标:", result.phonetics.us);
        }
      } catch (error) {
        console.warn('Offscreen: 提取音标失败:', error);
      }
      
      // 提取释义和例句
      try {
        // 选择所有的释义块
        const defBlocks = doc.querySelectorAll('.def-block.ddef_block');
        console.log(`Offscreen: 找到 ${defBlocks.length} 个释义块`);
        
        defBlocks.forEach(block => {
          // 获取释义文本
          const defElement = block.querySelector('.def.ddef_d.db');
          if (!defElement) return;
          
          const definitionText = defElement.textContent.trim();
          
          // 获取翻译（如果是双语词典）
          const transElement = block.querySelector('.trans.dtrans.dtrans-se');
          const translation = transElement ? transElement.textContent.trim() : '';
          
          // 获取例句
          const examples = [];
          const exampleElements = block.querySelectorAll('.examp.dexamp');
          
          exampleElements.forEach(exampleElem => {
            const exampleTextElem = exampleElem.querySelector('.eg.deg');
            const exampleTransElem = exampleElem.querySelector('.trans.dtrans.dtrans-se');
            
            if (exampleTextElem) {
              examples.push({
                text: exampleTextElem.textContent.trim(),
                translation: exampleTransElem ? exampleTransElem.textContent.trim() : ''
              });
            }
          });
          
          // 添加到结果中
          if (definitionText) {
            result.definitions.push({
              definition: definitionText,
              translation: translation,
              examples: examples
            });
          }
        });
      } catch (error) {
        console.warn('Offscreen: 提取释义和例句失败:', error);
      }
      
      // 检查是否成功提取到内容
      if (result.definitions.length === 0 && !result.phonetics.uk && !result.phonetics.us) {
        console.warn(`Offscreen: 未能解析出'${word}'的有效信息`);
        // 发送失败结果
        chrome.runtime.sendMessage({
          action: 'parseHTMLResult',
          success: false,
          error: '未找到该单词的释义或音标信息',
          word: word
        });
      } else {
        // 发送成功结果
        chrome.runtime.sendMessage({
          action: 'parseHTMLResult',
          success: true,
          result: result
        });
      }
    } catch (error) {
      console.error('Offscreen: 解析 HTML 时出错:', error);
      // 发送错误结果
      chrome.runtime.sendMessage({
        action: 'parseHTMLResult',
        success: false,
        error: error.message
      });
    }
  }
});