chrome.runtime.sendMessage({ type: 'user-cookie', payload: document.cookie }, function (response) {
  // console.log(response);
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (!sender.tab) {
    if (request.type === 'log') {
      console.log(request.payload)
      sendResponse({ result: 'ok', type: request.type })
    }
  }
});
