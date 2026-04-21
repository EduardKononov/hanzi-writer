(function () {
	var charInput = document.querySelector('.js-char');
	var quizLogPanel = document.getElementById('quiz-log-panel');
	var quizLogPre = document.getElementById('quiz-log');
	var quizDownloadBtn = document.getElementById('quiz-download');
	var lastQuizSummary = null;

	var writer = HanziWriter.create('target', charInput.value || '我', {
		width: 300,
		height: 300,
		padding: 5,
	});

	var characterShown = true;
	var outlineShown = true;

	function clearQuizLog() {
		lastQuizSummary = null;
		quizLogPre.textContent = '';
		quizLogPanel.hidden = true;
		quizDownloadBtn.disabled = true;
	}

	function showQuizLog(summary) {
		lastQuizSummary = summary;
		quizLogPre.textContent = JSON.stringify(summary, null, 2);
		quizLogPanel.hidden = false;
		quizDownloadBtn.disabled = false;
	}

	document.querySelector('.js-char-form').addEventListener('submit', function (e) {
		e.preventDefault();
		var c = (charInput.value || '').trim() || '我';
		charInput.value = c;
		clearQuizLog();
		writer.setCharacter(c);
	});

	document.querySelector('.js-toggle').addEventListener('click', function () {
		characterShown = !characterShown;
		if (characterShown) {
			writer.showCharacter();
		} else {
			writer.hideCharacter();
		}
	});

	document.querySelector('.js-toggle-hint').addEventListener('click', function () {
		outlineShown = !outlineShown;
		if (outlineShown) {
			writer.showOutline();
		} else {
			writer.hideOutline();
		}
	});

	document.querySelector('.js-animate').addEventListener('click', function () {
		writer.animateCharacter();
	});

	document.querySelector('.js-quiz').addEventListener('click', function () {
		clearQuizLog();
		writer.quiz({
			onComplete: function (summary) {
				showQuizLog(summary);
			},
		});
	});

	quizDownloadBtn.addEventListener('click', function () {
		if (!lastQuizSummary) return;
		var name =
			'quiz-log-' +
			String(lastQuizSummary.character || 'char').replace(/[^\w\-]+/g, '_') +
			'.json';
		var blob = new Blob([JSON.stringify(lastQuizSummary, null, 2)], {
			type: 'application/json',
		});
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	});
})();
