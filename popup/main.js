const bg = chrome.extension.getBackgroundPage();

const corscheckbox = document.getElementById('cors')
const samesitecheckbox = document.getElementById('samesite')

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs[0]
  if (!tab.url.startsWith('http://localhost:')) {
    document.getElementById('content').replaceWith('This extension only works with "http://localhost" site.')
    return
  }
  corscheckbox.checked = bg.iscorsenabled(tab)
  corscheckbox.addEventListener('click', evt => {
    bg.switchCORS(evt.target.checked, tab)
    if (evt.target.checked) {
      evt.target.title = evt.target.dataset.title
    } else {
      evt.target.removeAttribute('title')
    }
  })

  samesitecheckbox.checked = bg.issamesiteenabled(tab)
  samesitecheckbox.addEventListener('click', evt => {
    bg.switchSameSite(evt.target.checked, tab)
    if (evt.target.checked) {
      evt.target.title = evt.target.dataset.title
    } else {
      evt.target.removeAttribute('title')
    }
  })
})
