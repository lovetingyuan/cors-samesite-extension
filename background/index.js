const enabledCORSTabsMap = {}
const enabledSameSiteTabsMap = {}
const cookiesMap = {}

window.switchCORS = function (enable, tab) {
  if (enable) {
    enabledCORSTabsMap[tab.id] = true
  } else {
    delete enabledCORSTabsMap[tab.id]
  }
}

window.switchSameSite = function (enable, tab) {
  if (enable) {
    enabledSameSiteTabsMap[tab.id] = true
  } else {
    delete enabledSameSiteTabsMap[tab.id]
  }
}

window.iscorsenabled = function (tab) {
  return tab.id in enabledCORSTabsMap
}

window.issamesiteenabled = function (tab) {
  return tab.id in enabledSameSiteTabsMap
}

function modifyReqHeader (details) {
  if (enabledSameSiteTabsMap[details.tabId] && cookiesMap[details.tabId]) {
    const setCookieIndex = details.requestHeaders.findIndex(header => {
      return header.name.toLowerCase() === 'cookie'
    })
    if (setCookieIndex !== -1) {
      const header = details.requestHeaders[setCookieIndex]
      const requestCookies = header.value.split('; ')
      const userCookies = cookiesMap[details.tabId].split('; ').filter(item => {
        return !requestCookies.find(v => v.split('=')[0] === item.split('=')[0])
      }).join('; ')
      if (userCookies.length) {
        header.value = userCookies + '; ' + header.value
        return {
          requestHeaders: details.requestHeaders.slice()
        }
      }
    }
  }
}

function modifyRequest () {}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (sender.tab && sender.tab.url.startsWith('http://')) { // fix secure cookie not send for not https site
    if (request.type === 'user-cookie') {
      cookiesMap[sender.tab.id] = request.payload || ''
      sendResponse({ result: 'ok', type: request.type })
      return
    }
  }
  sendResponse({ result: 'not ok' })
})

setupHeaderModListener()

function sendToContentScript (type, payload) {
  const { promise, resolve } = new function() { this.promise = new Promise(resolve => this.resolve = resolve) }
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { type, payload }, function(response) {
      resolve(response)
    })
  })
  return promise
}

function modifyResHeader (details) {
  if (!enabledSameSiteTabsMap[details.tabId] && !enabledCORSTabsMap[details.tabId]) return
  if (enabledCORSTabsMap[details.tabId]) {
    const hasCors = details.responseHeaders.find(item => {
      return item.name.toLowerCase() === 'Access-Control-Allow-Origin'.toLowerCase()
    })
    const credential = details.responseHeaders.find(item => {
      return item.name.toLowerCase() === 'access-control-allow-credentials'
    })
    if (!credential) {
      details.responseHeaders.push({
        name: 'Access-Control-Allow-Credentials', value: 'true'
      })
    } else {
      credential.value = 'true'
    }
    const needCredential = true // credential && credential.value === 'true'
    if (!hasCors) {
      details.responseHeaders.push({
        name: 'Access-Control-Allow-Origin',
        value: needCredential ? details.initiator : '*'
      })
    } else {
      hasCors.value = needCredential ? details.initiator : '*'
    }
  }
  if (enabledSameSiteTabsMap[details.tabId]) {
    details.responseHeaders.forEach(item => {
      if (item.name.toLowerCase() === 'set-cookie') {
        let setcookie = item.value
        if (setcookie.includes('SameSite=')) {
          setcookie.replace(/SameSite=(Lax|Strict)/, 'SameSite=None')
        } else {
          setcookie = setcookie + '; SameSite=None'
        }
        if (!setcookie.includes('Secure')) {
          setcookie = setcookie + '; Secure'
        }
        item.value = setcookie
      }
    })
  }
  // sendToContentScript('log', 'modify response header')
  return {
    responseHeaders: details.responseHeaders.slice()
  }
}

function setupHeaderModListener() {
  chrome.webRequest.onHeadersReceived.removeListener(modifyResHeader);
  chrome.webRequest.onHeadersReceived.addListener(
    modifyResHeader,
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'blocking', 'extraHeaders']
  );

  chrome.webRequest.onBeforeSendHeaders.removeListener(modifyReqHeader);
  chrome.webRequest.onBeforeSendHeaders.addListener(
    modifyReqHeader,
    { urls: ['<all_urls>'] },
    ['requestHeaders', 'blocking', 'extraHeaders']
  );
  
  // chrome.webRequest.onBeforeRequest.removeListener(modifyRequest);
  // chrome.webRequest.onBeforeRequest.addListener(
  //   modifyRequest,
  //   { urls: ['<all_urls>'] },
  //   ['blocking']
  // );
}
