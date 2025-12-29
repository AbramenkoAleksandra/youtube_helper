// Функции можно вынести в отдельный модуль
// Получить активную вкладку
async function getActiveTabURL() {
    const tabs = await chrome.tabs.query({
        currentWindow: true,
        active: true
    });
  
    return tabs[0];
};

// Форматирование времени в HH:MM:SS
function formatTime(seconds, ms=false) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (ms) {
        const secs = (seconds % 60).toFixed(3);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(6, '0')}`;
    } else {
        const secs = Math.floor(seconds % 60);
        return `${hours ? hours.toString().padStart(2, '0')+':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
}

function stringToSeconds(timeString) {
    const [hours, minutes, seconds] = timeString.split(':');
    return (+hours) * 60 * 60 + (+minutes) * 60 + (+seconds);
}

function isValidTimeHHMMSS(timeString) {
  // Regex for HH:mm:ss in 24-hour format
  const regex = /^\d{1,3}:[0-5][0-9]:[0-5][0-9].\d{1,3}$/;
  return regex.test(timeString);
}


let editingBookmarkId = null;
let currentVideoUrl = null;
let currentVideoBookmarks =[];


//Формируем список заметок (для каждой заметки в массиве)
const addNewBookmark = (bookmarks, bookmark) => {
    const bookmarkElement = document.createElement('div');
    bookmarkElement.className = "note-card";
    bookmarkElement.setAttribute("data-id", bookmark.id);

    bookmarkElement.innerHTML = `
        <div class="note-header">
            <div class="note-left">
                <div class="note-timestamp">${formatTime(bookmark.time)}</div>
                <div class="note-title">${bookmark.name}</div>
                <div class="note-description">${bookmark.desc}</div>
            </div>
            <div class="note-actions">
                <button class="btn-icon btn-edit" onclick="editNote('${bookmark.id}')" title="Редактировать">
                    ✏️
                </button>
                <button class="btn-icon btn-delete" onclick="deleteNote('${bookmark.id}')" title="Удалить">
                    🗑️
                </button>
            </div>
        </div>
    `

    bookmarkElement.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-icon')) {
            playFromTime(bookmark.time);
        } else if (e.target.closest('.btn-edit')) {
            editBookmark(bookmark.id);
        } else if (e.target.closest('.btn-delete')) {
            deleteBookmark(bookmark.id);
        } 
    });
            
    bookmarks.appendChild(bookmarkElement);
};

// Отображение списка заметок (обновление формы popup)
const renderBookmarks = (currentBookmarks=[]) => {
    currentVideoBookmarks=currentBookmarks; //Если получаем из основного окна - обновляем текущий список
    const container = document.getElementById('notesContainer');
    
    if (!currentBookmarks || currentBookmarks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                Нет сохраненных заметок<br>
                Нажмите "Добавить заметку"
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    currentBookmarks.forEach(bookmark => {
        addNewBookmark(container, bookmark);
    });
}


// Воспроизведение с определенного времени (при нажатии на заметку)
const playFromTime = async (time) => {
    const activeTab = await getActiveTabURL();

    // Отправляем сообщение в content script для перемотки видео
    chrome.tabs.sendMessage(activeTab.id, {
        type: "PLAY",
        value: time,
    });
};


// Удаление заметки (при нажатии на кнопку корзины)
const deleteBookmark = async (id) => {
    if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
        const activeTab = await getActiveTabURL();
        const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");
        
        // Отправляем сообщение в background script об удалении заметки
        chrome.tabs.sendMessage(activeTab.id,{
            type: "DELETE",
            value: id,
            videoId: currentVideo,
        }, renderBookmarks);
    }
};



//////////////////////
//  МОДАЛЬНОЕ ОКНО  // 
//////////////////////

// Редактирование заметки - Открытие модального окна для редактирования
const editBookmark = (id) => {
    const bookmark = currentVideoBookmarks.find(b => b.id === id);
    if (!bookmark) return;
    
    editingBookmarkId = id;
    document.getElementById('modalTitle').textContent = 'Редактировать заметку';
    document.getElementById('bookmarkName').value = bookmark.name;
    const bookmarkTime = document.getElementById('bookmarkTime')
    if (bookmark.time<86400) {
        bookmarkTime.type = 'time'
    } else {
        bookmarkTime.type = 'text'
    }
    bookmarkTime.value = formatTime(bookmark.time, true);
    document.getElementById('bookmarkDescription').value = bookmark.desc;
    document.getElementById('bookmarkModal').style.display = 'flex';
    document.body.classList.add('modal-open');
}

// Кнопка отмены в модальном окне
document.getElementById('cancelBtn').addEventListener('click', function() {
    document.getElementById('bookmarkModal').style.display = 'none';
    document.body.classList.remove('modal-open');
});


// Закрытие модального окна при клике вне его
document.getElementById('bookmarkModal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
});


// Открытие модального окна редактирования/добавления заметки
document.getElementById('bookmarkForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('bookmarkName').value.trim();
    let time = document.getElementById('bookmarkTime').value;
    const desc = document.getElementById('bookmarkDescription').value.trim();
    
    if (!name) {
        alert('Пожалуйста, введите название заметки');
        return;
    }
    if (!isValidTimeHHMMSS(time)) {
        alert('Введите валидное время');
        return; 
    } else {
        time = stringToSeconds(time);
    }

    
    if (editingBookmarkId) {
        // Редактирование существующей заметки
        const index = currentVideoBookmarks.findIndex(b => b.id === editingBookmarkId);
        if (index !== -1) {
            let currBookmark = {
                id: editingBookmarkId,
                name,
                time,
                desc
            }
            saveNote(currBookmark)
        }
    } else {
        let currBookmark = {
            name,
            time,
            desc
        }
        saveNote(currBookmark, true)
    }
    
    // Закрытие модального окна
    document.getElementById('bookmarkModal').style.display = 'none';
    document.body.classList.remove('modal-open');
});

// Сохранение заметки
const saveNote = async (bookmark, newBookmark=false) => {
    const activeTab = await getActiveTabURL();
    const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");
    if (newBookmark) {
        chrome.tabs.sendMessage(activeTab.id,{
        type: "ADD_NEW",
        value: bookmark,
        videoId: currentVideo,
        }, renderBookmarks);
    } else {
        chrome.tabs.sendMessage(activeTab.id,{
        type: "EDIT",
        value: bookmark,
        videoId: currentVideo,
        }, renderBookmarks);
    }
};


// Получение текущего времени видео
const getCurrentVideoTime = async () => {
    const activeTab = await getActiveTabURL();
    // Отправляем сообщение в content script для перемотки видео
    chrome.tabs.sendMessage(activeTab.id, {
            type: "GET_TIME",
        }, async (currentTime) => {
            const bookmarkTime = document.getElementById('bookmarkTime')
            if (!currentTime) {
                currentTime=0;
            }
            if (currentTime<86400) {
                bookmarkTime.type = 'time'
            } else {
                bookmarkTime.type = 'text'
            }
            bookmarkTime.value = formatTime(currentTime, true);
        }
    );
}

// Открытие модального окна для добавления
const openAddModal = async () => {
    await getCurrentVideoTime();
    editingBookmarkId = null;
    document.getElementById('modalTitle').textContent = 'Добавить заметку';
    document.getElementById('bookmarkForm').reset();
    document.getElementById('bookmarkModal').style.display = 'flex';
    document.body.classList.add('modal-open');
}

// Кнопка добавления заметки
document.getElementById('addBookmarkBtn').addEventListener('click', openAddModal);

/////////////////////////
// END МОДАЛЬНОЕ ОКНО  // 
/////////////////////////


// Удаление всех заметок
const deleteAllBookmarks = async () => {
    if (currentVideoBookmarks.length === 0) {
        alert('Нет заметок для удаления');
        return;
    }
    if (confirm('Вы уверены, что хотите удалить все заметки?')) {
        const activeTab = await getActiveTabURL();
        const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");

        currentVideoBookmarks=[];
        
        // Отправляем сообщение в background script об удалении заметки
        chrome.tabs.sendMessage(activeTab.id,{
            type: "DELETE_ALL",
            videoId: currentVideo,
        }, renderBookmarks);
    }
};

// Кнопка Удаления всех заметок
document.getElementById('deleteBookmarksBtn').addEventListener('click', deleteAllBookmarks);




//Загрузить заметки из хранилища
const loadBookmarksFromStorage = async (currentVideo) => {
    if (!currentVideo) return;
    
    const result = await chrome.storage.sync.get(currentVideo);
    currentVideoBookmarks = result[currentVideo] ? JSON.parse(result[currentVideo]) : [];
}

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", async () => {
    const activeTab = await getActiveTabURL();
    const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");
    if (activeTab.url.includes("youtube.com/watch") && currentVideo) {
        await loadBookmarksFromStorage(currentVideo);
        renderBookmarks(currentVideoBookmarks);
    } else {
        // window.alert("Расширение только для Youtube");  
        window.close();
    }
});