/**
 * 音声文字起こし修正ツール
 * 音声ファイルを再生しながらテキスト編集を行うためのツール
 * 
 * 機能：
 * - 音声ファイル(.mp3/.wav)の読み込みと再生
 * - 文字起こしファイル(.txt)の読み込みと編集
 * - マーカー管理（追加/削除/ジャンプ）
 * - タイムスタンプ挿入
 * - 不明瞭箇所のマーキング
 * - テキスト検索
 * - ダークモード/ライトモード切替
 * - キーボードショートカット
 */

// ==================================================
// DOM要素の取得
// ==================================================
const elements = {
    // ファイル入力
    audioFileInput: document.getElementById('audio-file'),
    textFileInput: document.getElementById('text-file'),
    
    // 音声コントロール
    playPauseButton: document.getElementById('play-pause'),
    rewindButton: document.getElementById('rewind'),
    forwardButton: document.getElementById('forward'),
    seekSlider: document.getElementById('seek-slider'),
    currentTimeDisplay: document.getElementById('current-time'),
    durationDisplay: document.getElementById('duration'),
    playbackSpeedSelect: document.getElementById('playback-speed'),
    
    // マーカー管理
    addMarkerButton: document.getElementById('add-marker'),
    addTimestampButton: document.getElementById('add-timestamp'),
    addUnclearMarkButton: document.getElementById('add-unclear-mark'),
    markerList: document.getElementById('marker-list'),
    
    // テキスト編集
    transcriptEditor: document.getElementById('transcript-editor'),
    saveTextButton: document.getElementById('save-text'),
    autoSaveCheckbox: document.getElementById('auto-save'),
    
    // 検索機能
    searchInput: document.getElementById('search-input'),
    searchPrevButton: document.getElementById('search-prev'),
    searchNextButton: document.getElementById('search-next'),
    searchResults: document.getElementById('search-results'),
    
    // ショートカットヘルプ
    showShortcutsButton: document.getElementById('show-shortcuts'),
    shortcutsModal: document.getElementById('shortcuts-modal'),
    closeModalButton: document.querySelector('.close'),
    
    // テーマ切り替え
    themeToggle: document.getElementById('theme-toggle')
};

// ==================================================
// アプリケーション状態
// ==================================================
const state = {
    audio: null,            // Audio要素
    audioBlob: null,        // 音声ファイルのBlob
    fileName: {
        audio: '',          // 音声ファイル名
        text: ''            // テキストファイル名
    },
    isPlaying: false,       // 再生中かどうか
    markers: [],            // マーカー配列
    autoSaveEnabled: false, // 自動保存有効か
    autoSaveInterval: null, // 自動保存インターバルID
    lastSavedText: '',      // 最後に保存したテキスト
    search: {
        term: '',           // 検索キーワード
        matches: [],        // マッチした位置の配列
        currentIndex: -1,   // 現在の検索位置のインデックス
    },
    darkMode: false,        // ダークモード有効か
};

// ==================================================
// 初期化処理
// ==================================================

/**
 * アプリケーションの初期化
 */
function init() {
    console.log('音声文字起こし修正ツール 初期化中...');
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // LocalStorageから設定を復元
    loadSettings();
    
    // UI初期状態の設定
    updateUIState();
    
    console.log('音声文字起こし修正ツールの初期化が完了しました');
}

/**
 * すべてのイベントリスナーを設定
 */
function setupEventListeners() {
    // ファイル選択
    elements.audioFileInput.addEventListener('change', handleAudioFileSelect);
    elements.textFileInput.addEventListener('change', handleTextFileSelect);
    
    // 音声コントロール
    elements.playPauseButton.addEventListener('click', togglePlayPause);
    elements.rewindButton.addEventListener('click', rewindAudio);
    elements.forwardButton.addEventListener('click', forwardAudio);
    elements.seekSlider.addEventListener('input', handleSeek);
    elements.playbackSpeedSelect.addEventListener('change', changePlaybackSpeed);
    
    // マーカー管理
    elements.addMarkerButton.addEventListener('click', addMarker);
    elements.addTimestampButton.addEventListener('click', insertTimestamp);
    elements.addUnclearMarkButton.addEventListener('click', insertUnclearMark);
    
    // テキスト編集
    elements.saveTextButton.addEventListener('click', saveText);
    elements.autoSaveCheckbox.addEventListener('change', toggleAutoSave);
    
    // テキスト検索
    elements.searchInput.addEventListener('input', performSearch);
    elements.searchPrevButton.addEventListener('click', () => navigateSearch(-1));
    elements.searchNextButton.addEventListener('click', () => navigateSearch(1));
    
    // ショートカットモーダル
    elements.showShortcutsButton.addEventListener('click', showShortcutsModal);
    elements.closeModalButton.addEventListener('click', hideShortcutsModal);
    window.addEventListener('click', (e) => {
        if (e.target === elements.shortcutsModal) {
            hideShortcutsModal();
        }
    });
    
    // テーマ切り替え
    elements.themeToggle.addEventListener('change', toggleTheme);
    
    // キーボードショートカット
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * LocalStorageから設定を復元
 */
function loadSettings() {
    // 自動保存設定の復元
    const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') === 'true';
    elements.autoSaveCheckbox.checked = autoSaveEnabled;
    state.autoSaveEnabled = autoSaveEnabled;
    
    // ダークモード設定の復元
    const darkMode = localStorage.getItem('darkMode') === 'true';
    elements.themeToggle.checked = darkMode;
    state.darkMode = darkMode;
    if (darkMode) {
        document.body.classList.add('dark-theme');
    }
    
    // 前回のテキストを復元
    const savedText = localStorage.getItem('savedText');
    if (savedText) {
        elements.transcriptEditor.value = savedText;
        state.lastSavedText = savedText;
    }
    
    // マーカーを復元
    const savedMarkers = localStorage.getItem('markers');
    if (savedMarkers) {
        try {
            state.markers = JSON.parse(savedMarkers);
            updateMarkerList();
        } catch (e) {
            console.error('マーカーの復元中にエラーが発生しました', e);
        }
    }
}

/**
 * UI状態を更新
 */
function updateUIState() {
    // 音声ファイルがロードされているかどうかでUIを有効/無効に
    const audioLoaded = !!state.audio;
    
    elements.playPauseButton.disabled = !audioLoaded;
    elements.rewindButton.disabled = !audioLoaded;
    elements.forwardButton.disabled = !audioLoaded;
    elements.seekSlider.disabled = !audioLoaded;
    elements.playbackSpeedSelect.disabled = !audioLoaded;
    elements.addMarkerButton.disabled = !audioLoaded;
    elements.addTimestampButton.disabled = !audioLoaded;
    elements.addUnclearMarkButton.disabled = !audioLoaded;
    
    // 再生/停止ボタンの表示を更新
    elements.playPauseButton.textContent = state.isPlaying ? '⏸️' : '▶️';
    elements.playPauseButton.title = state.isPlaying ? '停止' : '再生';
}

// ==================================================
// ファイル操作
// ==================================================

/**
 * 音声ファイル選択ハンドラ
 * @param {Event} event - ファイル選択イベント
 */
function handleAudioFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // ファイルタイプチェック
    if (!file.type.match('audio/(mp3|wav|mpeg)')) {
        alert('MP3またはWAVファイルを選択してください。');
        event.target.value = '';
        return;
    }
    
    // ファイル名保存
    state.fileName.audio = file.name;
    
    // Blobとして読み込む
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
        state.audioBlob = new Blob([e.target.result], { type: file.type });
        loadAudio();
    };
    fileReader.readAsArrayBuffer(file);
}

/**
 * 音声をロード
 */
function loadAudio() {
    // 既存のAudio要素があれば解放
    if (state.audio) {
        state.audio.pause();
        state.audio.src = '';
        state.audio.remove();
    }
    
    // Blobから音声を作成
    const audioURL = URL.createObjectURL(state.audioBlob);
    state.audio = new Audio(audioURL);
    
    // 音声メタデータロード完了時
    state.audio.addEventListener('loadedmetadata', () => {
        console.log('音声メタデータがロードされました。長さ:', state.audio.duration, '秒');
        
        // シークバーの最大値を更新
        elements.seekSlider.max = Math.floor(state.audio.duration);
        elements.seekSlider.value = 0;
        
        // 再生時間表示の更新
        elements.currentTimeDisplay.textContent = formatTime(0);
        elements.durationDisplay.textContent = formatTime(state.audio.duration);
        
        // UI状態を更新
        updateUIState();
    });
    
    // 再生中のタイムアップデート
    state.audio.addEventListener('timeupdate', updateAudioProgress);
    
    // 再生終了時
    state.audio.addEventListener('ended', () => {
        state.isPlaying = false;
        updateUIState();
    });
    
    // エラーハンドリング
    state.audio.addEventListener('error', (e) => {
        console.error('音声ファイルのロード中にエラーが発生しました', e);
        alert('音声ファイルのロード中にエラーが発生しました。');
    });
}

/**
 * テキストファイル選択ハンドラ
 * @param {Event} event - ファイル選択イベント
 */
function handleTextFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // ファイルタイプチェック
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
        alert('テキストファイル(.txt)を選択してください。');
        event.target.value = '';
        return;
    }
    
    // ファイル名保存
    state.fileName.text = file.name;
    
    // テキストとして読み込む
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
        elements.transcriptEditor.value = e.target.result;
        state.lastSavedText = e.target.result;
    };
    fileReader.readAsText(file, 'UTF-8');
}

/**
 * テキストを保存
 */
function saveText() {
    const text = elements.transcriptEditor.value;
    const fileName = state.fileName.text || 'transcript.txt';
    
    // テキストをBlobに変換
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // ダウンロードリンクを作成
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    
    // リンクをクリックしてダウンロード
    document.body.appendChild(a);
    a.click();
    
    // クリーンアップ
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    
    // 最後に保存したテキストを更新
    state.lastSavedText = text;
    
    // 自動保存が有効なら、LocalStorageに保存
    if (state.autoSaveEnabled) {
        localStorage.setItem('savedText', text);
    }
}

/**
 * 自動保存の切り替え
 */
function toggleAutoSave() {
    state.autoSaveEnabled = elements.autoSaveCheckbox.checked;
    
    // LocalStorageに設定を保存
    localStorage.setItem('autoSaveEnabled', state.autoSaveEnabled);
    
    // 自動保存が有効になった場合
    if (state.autoSaveEnabled) {
        // 最初の保存
        localStorage.setItem('savedText', elements.transcriptEditor.value);
        
        // 定期的な保存を設定（30秒ごと）
        state.autoSaveInterval = setInterval(() => {
            const currentText = elements.transcriptEditor.value;
            if (currentText !== state.lastSavedText) {
                localStorage.setItem('savedText', currentText);
                state.lastSavedText = currentText;
                console.log('テキストが自動保存されました');
            }
        }, 30000);
    } else {
        // 自動保存を停止
        if (state.autoSaveInterval) {
            clearInterval(state.autoSaveInterval);
            state.autoSaveInterval = null;
        }
    }
}

// ==================================================
// 音声コントロール
// ==================================================

/**
 * 再生/停止の切り替え
 */
function togglePlayPause() {
    if (!state.audio) return;
    
    if (state.isPlaying) {
        state.audio.pause();
    } else {
        state.audio.play().catch(error => {
            console.error('再生開始時にエラーが発生しました', error);
            alert('再生開始時にエラーが発生しました。');
        });
    }
    
    state.isPlaying = !state.isPlaying;
    updateUIState();
}

/**
 * 5秒巻き戻し
 */
function rewindAudio() {
    if (!state.audio) return;
    
    state.audio.currentTime = Math.max(0, state.audio.currentTime - 5);
    updateAudioProgress();
}

/**
 * 5秒早送り
 */
function forwardAudio() {
    if (!state.audio) return;
    
    state.audio.currentTime = Math.min(state.audio.duration, state.audio.currentTime + 5);
    updateAudioProgress();
}

/**
 * シークバーハンドリング
 */
function handleSeek() {
    if (!state.audio) return;
    
    const seekTime = parseInt(elements.seekSlider.value);
    state.audio.currentTime = seekTime;
    updateAudioProgress();
}

/**
 * 再生速度変更
 */
function changePlaybackSpeed() {
    if (!state.audio) return;
    
    state.audio.playbackRate = parseFloat(elements.playbackSpeedSelect.value);
}

/**
 * 音声の進行状況を更新
 */
function updateAudioProgress() {
    if (!state.audio) return;
    
    const currentTime = state.audio.currentTime;
    
    // シークバーの位置を更新
    elements.seekSlider.value = Math.floor(currentTime);
    
    // 時間表示を更新
    elements.currentTimeDisplay.textContent = formatTime(currentTime);
}

/**
 * 時間をHH:MM:SS形式にフォーマット
 * @param {number} seconds - 秒数
 * @returns {string} - フォーマットされた時間文字列
 */
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [hrs, mins, secs]
        .map(val => val < 10 ? `0${val}` : val)
        .join(':');
}

// ==================================================
// マーカー管理
// ==================================================

/**
 * マーカーを追加
 */
function addMarker() {
    if (!state.audio) return;
    
    const currentTime = state.audio.currentTime;
    const markerId = Date.now(); // ユニークIDとしてタイムスタンプを使用
    
    // マーカーオブジェクト
    const marker = {
        id: markerId,
        time: currentTime,
        label: `マーカー ${state.markers.length + 1} (${formatTime(currentTime)})`
    };
    
    // マーカーを追加
    state.markers.push(marker);
    
    // マーカーリストを更新
    updateMarkerList();
}

/**
 * マーカーリストを更新
 */
function updateMarkerList() {
    // リストをクリア
    elements.markerList.innerHTML = '';
    
    // 時間順にソート
    const sortedMarkers = [...state.markers].sort((a, b) => a.time - b.time);
    
    // マーカー要素を追加
    sortedMarkers.forEach(marker => {
        const li = document.createElement('li');
        
        // マーカー情報
        const markerInfo = document.createElement('span');
        markerInfo.textContent = marker.label;
        
        // ボタンコンテナ
        const actionButtons = document.createElement('div');
        actionButtons.className = 'marker-actions';
        
        // ジャンプボタン
        const jumpButton = document.createElement('button');
        jumpButton.textContent = 'ジャンプ';
        jumpButton.className = 'jump-button';
        jumpButton.addEventListener('click', () => jumpToMarker(marker.time));
        
        // 削除ボタン
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '削除';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', () => deleteMarker(marker.id));
        
        // 要素を追加
        actionButtons.appendChild(jumpButton);
        actionButtons.appendChild(deleteButton);
        li.appendChild(markerInfo);
        li.appendChild(actionButtons);
        elements.markerList.appendChild(li);
    });
    
    // マーカーをLocalStorageに保存
    localStorage.setItem('markers', JSON.stringify(state.markers));
}

/**
 * マーカー位置にジャンプ
 * @param {number} time - ジャンプ先の時間（秒）
 */
function jumpToMarker(time) {
    if (!state.audio) return;
    
    state.audio.currentTime = time;
    updateAudioProgress();
}

/**
 * マーカーを削除
 * @param {number} markerId - 削除するマーカーのID
 */
function deleteMarker(markerId) {
    // 指定IDのマーカーを配列から削除
    state.markers = state.markers.filter(marker => marker.id !== markerId);
    
    // マーカーリストを更新
    updateMarkerList();
}

// ==================================================
// 編集支援機能
// ==================================================

/**
 * タイムスタンプをテキストに挿入
 */
function insertTimestamp() {
    if (!state.audio) return;
    
    const currentTime = state.audio.currentTime;
    const formattedTime = formatTime(currentTime);
    
    // テキストエリアにタイムスタンプを挿入
    const textarea = elements.transcriptEditor;
    const cursorPos = textarea.selectionStart;
    
    // カーソル位置にタイムスタンプを挿入
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    
    textarea.value = textBefore + `[${formattedTime}] ` + textAfter;
    
    // カーソル位置を更新
    const newCursorPos = cursorPos + formattedTime.length + 3; // [time] の長さ
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
}

/**
 * 不明瞭箇所マークを挿入
 */
function insertUnclearMark() {
    const textarea = elements.transcriptEditor;
    const cursorPos = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    
    // 選択範囲がある場合はその部分を不明瞭としてマーク
    if (cursorPos !== selectionEnd) {
        const textBefore = textarea.value.substring(0, cursorPos);
        const selectedText = textarea.value.substring(cursorPos, selectionEnd);
        const textAfter = textarea.value.substring(selectionEnd);
        
        textarea.value = textBefore + `???[${selectedText}]???` + textAfter;
        
        // カーソル位置を更新
        const newCursorPos = cursorPos + selectedText.length + 9; // ???[]??? の長さ
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    } else {
        // 選択範囲がない場合は単に ?????? を挿入
        const textBefore = textarea.value.substring(0, cursorPos);
        const textAfter = textarea.value.substring(cursorPos);
        
        textarea.value = textBefore + `??????` + textAfter;
        
        // カーソル位置を更新
        const newCursorPos = cursorPos + 6;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    textarea.focus();
}

// ==================================================
// テキスト検索
// ==================================================

/**
 * テキスト検索を実行
 */
function performSearch() {
    const searchTerm = elements.searchInput.value.trim();
    state.search.term = searchTerm;
    
    if (!searchTerm) {
        // 検索文字列が空の場合はハイライトをクリア
        state.search.matches = [];
        state.search.currentIndex = -1;
        elements.searchResults.textContent = '0/0';
        clearHighlights();
        return;
    }
    
    // テキスト内のすべてのマッチを探す
    const text = elements.transcriptEditor.value;
    const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + searchTerm.length
        });
    }
    
    state.search.matches = matches;
    state.search.currentIndex = matches.length > 0 ? 0 : -1;
    
    // 検索結果の表示を更新
    elements.searchResults.textContent = matches.length > 0 ? 
        `1/${matches.length}` : '0/0';
    
    // ハイライト表示
    highlightMatches();
    
    // 最初のマッチにスクロール
    if (matches.length > 0) {
        scrollToMatch(0);
    }
}

/**
 * 検索結果の前後に移動
 * @param {number} direction - 移動方向（1: 次へ, -1: 前へ）
 */
function navigateSearch(direction) {
    const { matches, currentIndex } = state.search;
    
    if (matches.length === 0) return;
    
    // 新しいインデックスを計算（循環）
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = matches.length - 1;
    if (newIndex >= matches.length) newIndex = 0;
    
    state.search.currentIndex = newIndex;
    
    // 表示を更新
    elements.searchResults.textContent = `${newIndex + 1}/${matches.length}`;
    
    // ハイライト更新
    highlightMatches();
    
    // 該当位置にスクロール
    scrollToMatch(newIndex);
}

/**
 * 正規表現用エスケープ
 * @param {string} string - エスケープする文字列
 * @returns {string} - エスケープされた文字列
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ハイライト表示
 */
function highlightMatches() {
    // テキストエリアの内容を取得
    const textarea = elements.transcriptEditor;
    
    // 現在のマッチにカーソルを移動
    const { matches, currentIndex } = state.search;
    if (matches.length > 0 && currentIndex >= 0) {
        const match = matches[currentIndex];
        textarea.setSelectionRange(match.start, match.end);
        textarea.focus();
    }
}

/**
 * ハイライトをクリア
 */
function clearHighlights() {
    elements.transcriptEditor.blur();
}

/**
 * マッチ位置にスクロール
 * @param {number} index - マッチのインデックス
 */
function scrollToMatch(index) {
    const match = state.search.matches[index];
    const textarea = elements.transcriptEditor;
    
    // 選択範囲を設定
    textarea.setSelectionRange(match.start, match.end);
    textarea.focus();
}

// ==================================================
// UI操作
// ==================================================

/**
 * ショートカットモーダルの表示
 */
function showShortcutsModal() {
    elements.shortcutsModal.style.display = 'block';
}

/**
 * ショートカットモーダルの非表示
 */
function hideShortcutsModal() {
    elements.shortcutsModal.style.display = 'none';
}

/**
 * テーマ切り替え
 */
function toggleTheme() {
    state.darkMode = elements.themeToggle.checked;
    
    if (state.darkMode) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    // 設定をLocalStorageに保存
    localStorage.setItem('darkMode', state.darkMode);
}

// ==================================================
// キーボードショートカット
// ==================================================

/**
 * キーボードショートカットハンドラ
 * @param {KeyboardEvent} event - キーボードイベント
 */
function handleKeyboardShortcuts(event) {
    // テキストエリアでの入力中は特定のショートカットだけ許可
    if (document.activeElement === elements.transcriptEditor) {
        // テキストエリア内で有効なショートカット
        switch (true) {
            case (event.ctrlKey && event.key === 's'): // Ctrl+S：保存
                event.preventDefault();
                saveText();
                break;
            case (event.ctrlKey && event.key === 'f'): // Ctrl+F：検索
                event.preventDefault();
                elements.searchInput.focus();
                break;
            case (event.ctrlKey && event.key === 't'): // Ctrl+T：タイムスタンプ挿入
                event.preventDefault();
                insertTimestamp();
                break;
            case (event.ctrlKey && event.key === 'q'): // Ctrl+Q：不明瞭マーク挿入
                event.preventDefault();
                insertUnclearMark();
                break;
        }
        return; // その他のショートカットはテキストエリア内では無効
    }
    
    // テキストエリア外での全ショートカット
    switch (event.key) {
        case ' ': // スペース：再生/停止
            event.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowLeft': // 左矢印：巻き戻し
            event.preventDefault();
            rewindAudio();
            break;
        case 'ArrowRight': // 右矢印：早送り
            event.preventDefault();
            forwardAudio();
            break;
        case 'm': // m：マーカー追加
            event.preventDefault();
            addMarker();
            break;
        case 't': // t：タイムスタンプ挿入
            event.preventDefault();
            insertTimestamp();
            break;
        case 'q': // q：不明瞭箇所マーク
            event.preventDefault();
            insertUnclearMark();
            break;
        case 's': // s（Ctrl+S）：保存
            if (event.ctrlKey) {
                event.preventDefault();
                saveText();
            }
            break;
        case 'f': // f（Ctrl+F）：検索
            if (event.ctrlKey) {
                event.preventDefault();
                elements.searchInput.focus();
            }
            break;
        case 'h': // h：ショートカットヘルプ
            event.preventDefault();
            showShortcutsModal();
            break;
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', init);