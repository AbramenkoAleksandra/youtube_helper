(() => {
    let youtubeRightControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];

    const fetchBookmarks = () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get([currentVideo], (obj) => {
                resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
            });
        });
    };

    //Добавить заметку по нажатию на иконку под видео
    const addNewBookmarkEventHandler = async () => {
        const currentTime = youtubePlayer.currentTime;

        currentVideoBookmarks = await fetchBookmarks();

        const newId = currentVideoBookmarks.length > 0 
            ? Math.max(...currentVideoBookmarks.map(b => b.id)) + 1 
            : 1;

        const newBookmark = {
            id: newId,
            name: "Заметка " + getTime(currentTime),
            time: currentTime,
            desc: "",
        };

        console.log(newBookmark);

        currentVideoBookmarks.push(newBookmark);
        currentVideoBookmarks.sort((a, b) => a.time - b.time)
 
        chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) }, () => {
            console.log("Bookmark note updated.");
        });

    };

    const newVideoLoaded = async () => {
        //Добавить кнопку + под видео (для добавления заметки)
        const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];

        currentVideoBookmarks = await fetchBookmarks();

        if (!bookmarkBtnExists) {
            const bookmarkBtn = document.createElement("button");

            const svgIconString = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <!-- The Plus Sign Path -->
                <path d="M12 5L12 19M5 12L19 12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                </svg>
            `;  
    
            bookmarkBtn.innerHTML = svgIconString;

            bookmarkBtn.className = "ytp-bookmark-btn " + "ytp-button " + "bookmark-btn";
            bookmarkBtn.title = "Добавить заметку";
            //Попытка сделать стиль подсказки как в соседних кнопках
            bookmarkBtn.setAttribute("aria-label", "Добавить заметку");
            bookmarkBtn.setAttribute("data-tooltip-title", "Добавить заметку");

            youtubeRightControls = document.getElementsByClassName("ytp-right-controls-left")[0];
            youtubePlayer = document.getElementsByClassName("video-stream")[0];

            youtubeRightControls.appendChild(bookmarkBtn);
            bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
        }
    };

    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        const { type, value, videoId } = obj;
        console.log(obj);

        if (type === "NEW") {
            currentVideo = videoId;
            newVideoLoaded();
        } else if (type === "PLAY") {
            youtubePlayer.currentTime = value;
        } else if (type === "GET_TIME") {
            response(youtubePlayer.currentTime);
        } else if ( type === "DELETE") {
            currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.id != value);
            chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) });

            response(currentVideoBookmarks);
        } else if ( type === "DELETE_ALL") {
            currentVideoBookmarks = [];
            // chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) });
            chrome.storage.sync.remove([currentVideo]);

            response(currentVideoBookmarks);
        } else if ( type === "EDIT") {
            for (let i = 0; i < currentVideoBookmarks.length; i++) {
                if (currentVideoBookmarks[i].id === value.id) {
                    currentVideoBookmarks[i].name = value.name;
                    currentVideoBookmarks[i].time = value.time;
                    currentVideoBookmarks[i].desc = value.desc;
                    break;
                }
            }
            currentVideoBookmarks.sort((a, b) => a.time - b.time);
            // Update the stored bookmarks with the new note
            chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) }, () => {
                console.log("Bookmark note updated.");
            });
            console.log(currentVideoBookmarks);
            response(currentVideoBookmarks);
        } else if ( type === "ADD_NEW") {
            const newId = currentVideoBookmarks.length > 0 
                ? Math.max(...currentVideoBookmarks.map(b => b.id)) + 1 
                : 1;
            value.id = newId;
            currentVideoBookmarks.push(value);
            currentVideoBookmarks.sort((a, b) => a.time - b.time)
            // Update the stored bookmarks with the new note
            chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) }, () => {
                console.log("Bookmark note updated.");
            });
            response(currentVideoBookmarks);
        }
    });
    newVideoLoaded();
})();

const getTime = t => {
    var date = new Date(0);
    date.setSeconds(t);

    return date.toISOString().substring(11,19);
};