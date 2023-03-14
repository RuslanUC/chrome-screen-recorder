let mediaRecorder;
let recordedChunks = [];
let ws;
let startBtn = document.getElementById("start"),
    stopBtn = document.getElementById("stop"),
    preview = document.getElementById("preview-video"),
    downloadCb = document.getElementById("r_download"),
    streamCb = document.getElementById("r_stream");
    wsSettings = document.getElementById("ws_settings");
    wsUrl = document.getElementById("r_ws");

function handleDataAvailable(options) {
    return function(event) {
        if (event.data.size > 0) {
            if(options.download)
                recordedChunks.push(event.data);
            if(options.stream)
                ws.send(event.data);
        }
    }
}

function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

async function startRecording(r_options) {
    if(!r_options?.stream && !r_options?.download)
        throw "Options must include one of (stream, download)";
    let stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        var options = { mimeType: "video/webm;codecs=vp9" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=h264")) {
        var options = { mimeType: "video/webm;codecs=h264" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        var options = { mimeType: "video/webm;codecs=vp8" };
    }

    options.audioBitsPerSecond = 192_000;
    options.videoBitsPerSecond = 2_500_000;
    if(r_options.stream)
        ws = new WebSocket(wsUrl.value);

    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = handleDataAvailable(r_options);
    mediaRecorder.onerror = (err) => { console.log("err:"+err); }
    mediaRecorder.onwarning = (err) => { console.log("warn:"+err); }
    mediaRecorder.addEventListener('stop', function() {
        if(r_options.stream)
            ws.close();
        if(r_options.download) {
            let blob = new Blob(recordedChunks, {type: recordedChunks[0].type});
            download(blob, `recorded_${(new Date()).getTime()}.webm`);
        }

        for(let track of stream.getTracks()) {
            track.stop();
        }
        mediaRecorder = undefined;
        recordedChunks = [];
        ws = undefined;
        preview.srcObject = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    stream.oninactive = () => { mediaRecorder.stop(); }
    preview.srcObject = stream;

    mediaRecorder.start(250);
}

function setCookie(name, value) {
    let expire = new Date((new Date()).getTime() + 30 * 24 * 3600 * 1000); // plus 30 days
    document.cookie = name + "=" + value + "; path=/; expires=" + expire.toGMTString();
}

function getCookie(name, def) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return def;
}

startBtn.addEventListener("click", (e) => {
    let options = {stream: streamCb.checked, download: downloadCb.checked};
    startRecording(options);
    startBtn.disabled = true;
    stopBtn.disabled = false;
});

stopBtn.addEventListener("click", (e) => {
    if(mediaRecorder !== undefined)
        mediaRecorder.stop();
    preview.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

streamCb.addEventListener("change", (e) => {
    setCookie("input_streamCb.checked", streamCb.checked); // Save state
    if(streamCb.checked)
        wsSettings.style.display = "block";
    else
        wsSettings.style.display = "none";
});

downloadCb.addEventListener("change", (e) => {
    setCookie("input_downloadCb.checked", downloadCb.checked); // Save state
});

wsUrl.addEventListener("input", (e) => {
    setCookie("input_wsUrl.value", wsUrl.value); // Save state
})

// Load states
downloadCb.checked = getCookie("input_downloadCb.checked", "true") == "true";
streamCb.checked = getCookie("input_streamCb.checked") == "true";
wsSettings.style.display = (streamCb.checked) ? "block" : "none";
wsUrl.value = getCookie("input_wsUrl.value", "");