document.getElementById("req-btn").addEventListener("click", async () => {
  const btn = document.getElementById("req-btn");
  const successMsg = document.getElementById("success-msg");
  const errorMsg = document.getElementById("error-msg");

  btn.textContent = "⏳ Requesting...";
  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  try {
    // This is the ONLY reliable way to trigger the permissions dialog in MV3
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach(track => track.stop()); // Instantly stop it, we only needed permission
    
    btn.style.display = "none";
    successMsg.style.display = "block";
  } catch (err) {
    btn.textContent = "🎤 Grant Permission";
    errorMsg.style.display = "block";
    if (err.name === "NotAllowedError") {
      errorMsg.innerHTML = "❌ Permission denied. Look at the right edge of your Chrome address bar, click the blocked camera/mic icon, and select 'Always allow'. Then try again.";
    } else {
      errorMsg.textContent = "Error: " + err.message;
    }
  }
});

// Check if we already have it
navigator.permissions.query({ name: "microphone" }).then(res => {
  if (res.state === "granted") {
    document.getElementById("req-btn").style.display = "none";
    document.getElementById("success-msg").style.display = "block";
    document.getElementById("success-msg").textContent = "✅ Microphone access is already granted!";
  }
});
