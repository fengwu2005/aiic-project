async function requestAI(task, context) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ task, context })
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `AI request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "AI request failed");
  return data.result;
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (state.authToken) headers.Authorization = `Bearer ${state.authToken}`;
  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function setAuth(token, user) {
  state.authToken = token || "";
  state.user = user || null;
  if (token) {
    localStorage.setItem("projectInterrogatorToken", token);
  } else {
    localStorage.removeItem("projectInterrogatorToken");
  }
  renderAuth();
}

function ensureLoggedIn() {
  if (state.user && state.authToken) return true;
  alert("请先登录或注册，这样每次模拟和问答日志才能保存。");
  $("#loginUsername").focus();
  return false;
}

async function loadMe() {
  if (!state.authToken) {
    renderAuth();
    return;
  }
  try {
    const data = await apiRequest("/api/me");
    state.user = data.user;
    renderAuth();
    await loadHistory();
  } catch (error) {
    setAuth("", null);
  }
}

function renderAuth() {
  const authed = Boolean(state.user);
  $("#authForm").classList.toggle("hidden", authed);
  $("#userBox").classList.toggle("hidden", !authed);
  $("#historyBox").classList.toggle("hidden", !authed);
  $("#currentUser").textContent = authed ? state.user.username : "未登录";
}

async function handleAuth(mode) {
  const username = $("#loginUsername").value.trim();
  const password = $("#loginPassword").value;
  if (username.length < 3 || password.length < 6) {
    alert("用户名至少 3 位，密码至少 6 位。");
    return;
  }
  const data = await apiRequest(`/api/${mode}`, {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setAuth(data.token, data.user);
  $("#loginPassword").value = "";
  await loadHistory();
}

async function logout() {
  try {
    await apiRequest("/api/logout", { method: "POST", body: "{}" });
  } catch (error) {
    console.warn("logout failed:", error);
  }
  setAuth("", null);
  state.history = [];
  renderHistory();
  newSimulation();
}

async function loadHistory() {
  if (!state.user) return;
  try {
    const data = await apiRequest("/api/sessions");
    state.history = data.sessions || [];
    renderHistory();
  } catch (error) {
    console.warn("history failed:", error);
  }
}

function renderHistory() {
  const list = $("#historyList");
  if (!state.history.length) {
    list.innerHTML = "<li>还没有历史模拟。</li>";
    return;
  }
  list.innerHTML = state.history.map((item) => `
    <li>
      <button type="button" class="history-item" data-session-id="${item.id}">
        <strong>${sanitize(item.title || "项目拷问")}</strong>
        <span>${item.status === "active" ? "进行中" : "已结束"} · ${formatDate(item.updatedAt)}</span>
      </button>
    </li>
  `).join("");
  $$(".history-item").forEach((button) => {
    button.addEventListener("click", () => openHistorySession(Number(button.dataset.sessionId)));
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function makeSessionTitle(projectText) {
  return projectText.replace(/\s+/g, " ").slice(0, 28) || "新的项目拷问";
}

function syncLiveOptions() {
  state.intensity = $("#intensity").value;
  state.interviewerStyle = $("#interviewerStyle").value;
  state.feedbackMode = $("#feedbackMode").value;
}

function setLockedProjectInputs(locked) {
  ["track", "jdKeywords", "projectText", "focusText"].forEach((id) => {
    $(`#${id}`).disabled = locked;
  });
  $("#loadSample").disabled = locked;
}
