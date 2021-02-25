let chunks = [];
let mediaRecorder;
let micID;
let stream;
let audioBlob;
let clicked = false;
let remoteConnected = false;
let status = [];
let remote;
let mic;

let micCheckInterval = null;
let micCheckRetries = 0;
let micFound = false;

let audioEl = document.querySelector('audio');
let buttonEl = document.querySelector('button');

async function fetchGet(url = '') {
  const res = await fetch(url);
  return await res.json();
}

async function fetchPost(url = '', data = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setupWebSockets() {
  const socket = new WebSocket(`ws://${location.host}/events`);

  socket.onmessage = function (msg) {
    let event = JSON.parse(msg.data);
    if (
      event.type === 'bluetooth/device_connected' ||
      event.type === 'bluetooth/device_disconnected' ||
      event.type === 'bluetooth/device_lost'
    ) {
      console.log(event);
    }
  };

  socket.onclose = function (msg) {
    if (msg.wasClean) {
      console.log(`[close] Connection closed cleanly, code=${msg.code} reason=${msg.reason}`);
    } else {
      console.log('[close] Connection died');
    }
  };

  socket.onerror = function (error) {
    console.error(`[error] ${error.message}`);
  };
}

async function setMicDeviceInfo() {
  console.log('checking for device info');
  if (!micFound) {
    let deviceInfos = await navigator.mediaDevices.enumerateDevices();
    micCheckRetries++;
    deviceInfos.forEach((deviceInfo) => {
      if (deviceInfo.kind === 'audioinput' && deviceInfo.label === 'mFC Mic_0A') {
        micFound = true;
        console.log('found device: ', deviceInfo.deviceId);
        if (micCheckInterval) clearInterval(micCheckInterval);
        micID = deviceInfo.deviceId;
      }
    });
  } else if (micCheckInterval) clearInterval(micCheckInterval);

  if (micCheckRetries >= 20 && micCheckInterval) {
    console.log('have exhausted mic check');
    clearInterval(micCheckInterval);
    micID = null;
  }
}

async function handleKeyup(e) {
  console.log(e.keyCode);
  // TALK BUTTON
  if (e.keyCode === 131) {
    try {
      if (!remoteConnected) {
        await bluetoothOperation(mic.address, 'connect');
        remoteConnected = true;
        micCheckInterval = setInterval(setMicDeviceInfo, 250);
        // await wait(1000);
        // let deviceInfos = await navigator.mediaDevices.enumerateDevices();
        // console.log(deviceInfos);
        // let remoteMic = deviceInfos.find((device) => device.label === 'mFC Mic_0A');
        // micID = remoteMic.deviceId;
        if (!stream) {
          audioInit();
        } else setupRecorder();
      } else {
        await bluetoothOperation(mic.address, 'disconnect');
        remoteConnected = false;
      }
    } catch (err) {
      console.error('handleKeyup', err);
    }
  }
  // ESC
  if (e.keyCode === 27) {
    buttonEl.disabled = false;
    buttonEl.innerText = 'RECORD';
    audioEl.src = '';
    chunks = [];
    mediaRecorder = null;
    audioBlob = null;
    clicked = false;
    // setupRecorder();
  }
  // RETURN
  if (e.keyCode === 13) {
    record();
  }
  // SPACE
  if (e.keyCode === 32) {
    audioEl.play().catch(console.error);
  }
  // B
  if (e.keyCode === 66) {
    status = await getStatus();
  }
}

function record() {
  try {
    if (!clicked) {
      mediaRecorder.start();
      buttonEl.innerText = 'STOP';
      clicked = true;
    } else {
      mediaRecorder.requestData();
      mediaRecorder.stop();
      bluetoothOperation(mic.address, 'disconnect');
      remoteConnected = false;
      buttonEl.disabled = true;
    }
  } catch (err) {
    console.error('record', err);
  }
}

function setupRecorder() {
  mediaRecorder = new MediaRecorder(stream, { type: 'audio/webm' });
  mediaRecorder.ondataavailable = (e) => {
    console.log(e.data);
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  mediaRecorder.onerror = (e) => {
    throw e.error || new Error(e.name);
  };
  mediaRecorder.onstop = (e) => {
    audioBlob = new Blob(chunks, { type: 'audio/webm' });
    audioEl.src = URL.createObjectURL(audioBlob);
  };
}

async function audioInit() {
  try {
    // stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: micID,
      },
    });
    setupRecorder();
  } catch (err) {
    console.error(err.name, err.message);
  }
}

async function scan() {
  const { result } = await fetchPost('/api/bluetooth/scan', {
    timeout: 10000,
  });
  console.log('scan', result);
  return result;
}

async function getStatus() {
  const { result } = await fetchGet('/api/bluetooth/status');
  console.log('status', result);
  return result;
}

async function bluetoothOperation(macAddress, operation = 'pair') {
  const { result } = await fetchPost(`/api/bluetooth/${operation}`, {
    address: macAddress,
  });
  console.log(macAddress, result);
  return result;
}

async function pairMic() {
  try {
    status = await getStatus();
    if (status == 'bluetooth_uninitialized') {
      console.log('no BT yet, try again shortly.');
      setTimeout(pairMic, 3000);
    } else {
      remote = status.find((device) => device.alias === 'mFC RCU_0A');
      mic = status.find((device) => device.alias === 'mFC Mic_0A');
      if (!remote || remote.paired !== true) {
        await scan();
        let remoteResult = await pair(remote.address); // remote
        if (remoteResult === 'paired') {
          await bluetoothOperation(mic.address, 'pair'); // mic
        }
      } else console.log('remote is paired');
    }
  } catch (err) {
    console.error('pairMic', err);
  }
}

buttonEl.addEventListener('click', record);

document.addEventListener('keyup', handleKeyup);

pairMic();
setupWebSockets();
// audioInit();
