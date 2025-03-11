/*
 * Main functions: core call infrastructure, setting up the callframe and event listeners, creating room URL, and joining
 * Event listener callbacks: fired when specified Daily events execute
 * Call panel button functions: participant controls
 */

/* Main functions */
let callFrame = null; // Initialize as null to check existence
let room, networkUpdateID;

async function createCallframe() {
  const callWrapper = document.getElementById('wrapper');

  // Check if callFrame already exists
  if (callFrame) {
    console.log('Reusing existing callFrame instance');
    return; // Exit if it already exists
  }

  // Create a new callFrame only if it doesn’t exist
  callFrame = window.DailyIframe.createFrame(callWrapper);

  callFrame
    .on('loaded', showEvent)
    .on('started-camera', showEvent)
    .on('camera-error', showEvent)
    .on('joining-meeting', toggleLobby)
    .on('joined-meeting', handleJoinedMeeting)
    .on('left-meeting', handleLeftMeeting);

  const roomURL = document.getElementById('url-input');
  const joinButton = document.getElementById('join-call');
  const createButton = document.getElementById('create-and-start');
  roomURL.addEventListener('input', () => {
    if (roomURL.checkValidity()) {
      joinButton.classList.add('valid');
      joinButton.classList.remove('disabled-button');
      joinButton.removeAttribute('disabled');
      createButton.classList.add('disabled-button');
    } else {
      joinButton.classList.remove('valid');
    }
  });

  roomURL.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      joinButton.click();
    }
  });
}

async function createRoom() {
  try {
    const response = await fetch('/api/create-room'); // Adjust URL if backend is hosted elsewhere
    const data = await response.json();
    return { url: data.url };
  } catch (e) {
    console.error('Error fetching room URL:', e);
    return null;
  }
}

async function createRoomAndStart() {
  const createAndStartButton = document.getElementById('create-and-start');
  const copyUrl = document.getElementById('copy-url');
  const errorTitle = document.getElementById('error-title');
  const errorDescription = document.getElementById('error-description');

  createAndStartButton.innerHTML = 'Loading...';

  room = await createRoom();
  if (!room) {
    errorTitle.innerHTML = 'Error creating room';
    errorDescription.innerHTML =
      'Failed to connect to the backend. Please check if the server is running.';
    toggleMainInterface();
    toggleError();
    createAndStartButton.innerHTML = 'Start';
    return;
  }
  copyUrl.value = room.url;

  showDemoCountdown();

  try {
    await callFrame.join({
      url: room.url,
      showLeaveButton: true,
    });
  } catch (e) {
    toggleError();
    console.error(e);
  }
  createAndStartButton.innerHTML = 'Start';
}

async function joinCall() {
  const url = document.getElementById('url-input').value;
  const copyUrl = document.getElementById('copy-url');
  copyUrl.value = url;

  try {
    await callFrame.join({
      url: url,
      showLeaveButton: true,
    });
  } catch (e) {
    if (
      e.message === "can't load iframe meeting because url property isn't set"
    ) {
      toggleMainInterface();
      console.log('empty URL');
    }
    toggleError();
    console.error(e);
  }
}

/* Event listener callbacks and helpers */
function showEvent(e) {
  console.log('callFrame event', e);
}

function toggleHomeScreen() {
  const homeScreen = document.getElementById('start-container');
  homeScreen.classList.toggle('hide');
}

function toggleLobby() {
  const callWrapper = document.getElementById('wrapper');
  callWrapper.classList.toggle('in-lobby');
  toggleHomeScreen();
}

function toggleControls() {
  const callControls = document.getElementById('call-controls-wrapper');
  callControls.classList.toggle('hide');
}

function toggleCallStyling() {
  const callWrapper = document.getElementById('wrapper');
  const createAndStartButton = document.getElementById('create-and-start');
  createAndStartButton.innerHTML = 'Start';
  callWrapper.classList.toggle('in-call');
}

function toggleError() {
  const errorMessage = document.getElementById('error-message');
  errorMessage.classList.toggle('error-message');
  toggleControls();
  toggleCallStyling();
}

function toggleMainInterface() {
  toggleHomeScreen();
  toggleControls();
  toggleCallStyling();
}

function handleJoinedMeeting() {
  toggleLobby();
  toggleMainInterface();
  startNetworkInfoPing();
}

function handleLeftMeeting() {
  toggleMainInterface();
  if (networkUpdateID) {
    clearInterval(networkUpdateID);
    networkUpdateID = null;
  }
  // Optionally destroy the callFrame here if you want to allow re-creation
  // callFrame.destroy();
  // callFrame = null;
}

function resetErrorDesc() {
  const errorTitle = document.getElementById('error-title');
  const errorDescription = document.getElementById('error-description');

  errorTitle.innerHTML = 'Incorrect room URL';
  errorDescription.innerHTML =
    'Meeting link entered is invalid. Please update the room URL.';
}

function tryAgain() {
  toggleError();
  toggleMainInterface();
  resetErrorDesc();
}

/* Call panel button functions */
function copyUrl() {
  const url = document.getElementById('copy-url');
  const copyButton = document.getElementById('copy-url-button');
  url.select();
  document.execCommand('copy');
  copyButton.innerHTML = 'Copied!';
}

function toggleCamera() {
  callFrame.setLocalVideo(!callFrame.participants().local.video);
}

function toggleMic() {
  callFrame.setLocalAudio(!callFrame.participants().local.audio);
}

function toggleScreenshare() {
  let participants = callFrame.participants();
  const shareButton = document.getElementById('share-button');
  if (participants.local) {
    if (!participants.local.screen) {
      callFrame.startScreenShare();
      shareButton.innerHTML = 'Stop screenshare';
    } else if (participants.local.screen) {
      callFrame.stopScreenShare();
      shareButton.innerHTML = 'Share screen';
    }
  }
}

function toggleFullscreen() {
  callFrame.requestFullscreen();
}

function toggleLocalVideo() {
  const localVideoButton = document.getElementById('local-video-button');
  const currentlyShown = callFrame.showLocalVideo();
  callFrame.setShowLocalVideo(!currentlyShown);
  localVideoButton.innerHTML = `${
    currentlyShown ? 'Show' : 'Hide'
  } local video`;
}

function toggleParticipantsBar() {
  const participantsBarButton = document.getElementById(
    'participants-bar-button',
  );
  const currentlyShown = callFrame.showParticipantsBar();
  callFrame.setShowParticipantsBar(!currentlyShown);
  participantsBarButton.innerHTML = `${
    currentlyShown ? 'Show' : 'Hide'
  } participants bar`;
}

/* Other helper functions */
function startNetworkInfoPing() {
  networkUpdateID = setInterval(() => {
    updateNetworkInfoDisplay();
  }, 2000);
}

async function updateNetworkInfoDisplay() {
  const videoSend = document.getElementById('video-send'),
    videoReceive = document.getElementById('video-receive'),
    videoPacketSend = document.getElementById('video-packet-send'),
    videoPacketReceive = document.getElementById('video-packet-receive');

  const statsInfo = await callFrame.getNetworkStats();
  const stats = statsInfo.stats;
  const latest = stats.latest;
  videoSend.innerHTML = `${Math.floor(
    latest.videoSendBitsPerSecond / 1000,
  )} kb/s`;

  videoReceive.innerHTML = `${Math.floor(
    latest.videoRecvBitsPerSecond / 1000,
  )} kb/s`;

  videoPacketSend.innerHTML = `${Math.floor(
    stats.worstVideoSendPacketLoss * 100,
  )}%`;

  videoPacketReceive.innerHTML = `${Math.floor(
    stats.worstVideoRecvPacketLoss * 100,
  )}%`;
}

function showRoomInput() {
  const urlInput = document.getElementById('url-input');
  const urlClick = document.getElementById('url-click');
  const urlForm = document.getElementById('url-form');
  urlClick.classList.remove('show');
  urlClick.classList.add('hide');

  urlForm.classList.remove('hide');
  urlForm.classList.add('show');
  urlInput.focus();
}

function showDemoCountdown() {
  const countdownDisplay = document.getElementById('demo-countdown');

  if (!window.expiresUpdate) {
    window.expiresUpdate = setInterval(() => {
      let exp = room && room.config && room.config.exp;
      if (exp) {
        let seconds = Math.floor((new Date(exp * 1000) - Date.now()) / 1000);
        let minutes = Math.floor(seconds / 60);
        let remainingSeconds = Math.floor(seconds % 60);

        countdownDisplay.innerHTML = `Demo expires in ${minutes}:${
          remainingSeconds > 10 ? remainingSeconds : '0' + remainingSeconds
        }`;
      }
    }, 1000);
  }
}

// Initialize the call frame when the page loads
document.addEventListener('DOMContentLoaded', () => {
  createCallframe();
});