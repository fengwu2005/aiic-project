function switchTab(tabName) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  $$(".tab-view").forEach((view) => view.classList.remove("active"));
  $(`#${tabName}View`).classList.add("active");
}

$("#startSession").addEventListener("click", startSession);
$("#resetSession").addEventListener("click", resetSession);
$("#stopSession").addEventListener("click", stopInterview);
$("#newSession").addEventListener("click", newSimulation);
$("#refreshHistory").addEventListener("click", (event) => {
  event.stopPropagation();
  loadHistory();
});
$("#loginButton").addEventListener("click", () => handleAuth("login").catch((error) => alert(error.message)));
$("#registerButton").addEventListener("click", () => handleAuth("register").catch((error) => alert(error.message)));
$("#logoutButton").addEventListener("click", logout);
$("#answerForm").addEventListener("submit", submitAnswer);
$("#intensity").addEventListener("change", syncLiveOptions);
$("#interviewerStyle").addEventListener("change", syncLiveOptions);
$("#feedbackMode").addEventListener("change", syncLiveOptions);
$("#loadSample").addEventListener("click", () => {
  $("#track").value = "code";
  $("#intensity").value = "senior";
  $("#interviewerStyle").value = "mixed";
  $("#jdKeywords").value = "代码质量、AI 评审、服务稳定性、Python、评测";
  $("#focusText").value = "代码实现、误报漏报、工程落地、行业趋势";
  $("#projectText").value = sampleProject;
});

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

renderScores();
renderAuth();
loadMe();
