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
  if (!/^https?:\/\/localhost:\d+/.test(details.initiator)) {
    return
  }
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
        console.log('modifyreqheader')
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

function addHeader (headers, name, value) {
  const head = headers.find(item => {
    return item.name.toLowerCase() === name.toLowerCase()
  })
  if (!head) {
    if (typeof value === 'function') {
      value = value()
      if (value === undefined) {
        return
      }
    }
    headers.push({
      name, value: value + ''
    })
  } else {
    head.value = (typeof value === 'function' ? value(head.value) : value) + ''
  }
}

function modifyResHeader (details) {
  if (!/^https?:\/\/localhost:\d+/.test(details.initiator)) {
    return
  }
  if (!enabledSameSiteTabsMap[details.tabId] && !enabledCORSTabsMap[details.tabId]) return
  if (enabledCORSTabsMap[details.tabId]) {
    // if (details.method === 'OPTIONS' && details.statusCode !== 200) {
    //   details.statusCode = 200
    //   details.statusLine = 'HTTP/1.1 200'
    //   addHeader(details.responseHeaders, 'status', 200)
    // }
    Object.entries({
      'Access-Control-Allow-Origin': details.initiator,
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Methods': [
        'GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'
      ],
      'Access-Control-Allow-Headers': originvalue => {
        let list = []
        if (originvalue) {
          list = originvalue.split(',').map(v => v.trim())
        }
        list = list.concat([
          'authorization'
        ])
        return [...new Set(list)]
      },
      'Set-Cookie': cookie => {
        if (!cookie || !cookie.trim()) return
        let setcookie = cookie
        if (setcookie.includes('SameSite=')) {
          setcookie.replace(/SameSite=(Lax|Strict)/, 'SameSite=None')
        } else {
          setcookie = setcookie + '; SameSite=None'
        }
        if (!setcookie.includes('Secure')) {
          setcookie = setcookie + '; Secure'
        }
        return setcookie
      }
    }).forEach(([name, value]) => {
      addHeader(details.responseHeaders, name, value)
    })
  }
  // sendToContentScript('log', 'modify response header')
  console.log('modifyresheader')

  return {
    responseHeaders: details.responseHeaders.slice()
  }
}

function onTabUpdate (tabId, changeInfo, tab) {
  // console.log(tabId, changeInfo, tab)
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

  chrome.tabs.onUpdated.removeListener(onTabUpdate);
  chrome.tabs.onUpdated.addListener(onTabUpdate);
  
  // chrome.webRequest.onBeforeRequest.removeListener(modifyRequest);
  // chrome.webRequest.onBeforeRequest.addListener(
  //   modifyRequest,
  //   { urls: ['<all_urls>'] },
  //   ['blocking']
  // );
}
