chrome.runtime.sendMessage({ type: 'user-cookie', payload: document.cookie }, function (response) {
  // console.log(response);
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (!sender.tab) {
    if (request.type === 'log') {
      sendResponse({ result: 'ok', type: request.type })
      return
    }
    if (request.type === 'reload') {
      location.reload()
      sendResponse({ result: 'ok', type: request.type })
      return
    }
  }
  sendResponse({ result: 'not ok' })
});
