FileService.MODE_LOCAL = 0x1;
FileService.MODE_SERVER = 0x2;
FileService.MODE_INTERNAL = 0x4;
FileService.MODE_EXTERNAL = 0x8;

FileService.windowLoaded = false;

FileService.windowOnLoad = function () {
    FileService.windowLoaded = true;
    window.removeEventListener("load", FileService.windowOnLoad);
};

function FileService() {
    this.isChromeApp = !!chrome.fileSystem;
    this.isReady = false;
    this.fileSystem = null;
    this.queuedTasks = [];
    this.mode = FileService.MODE_LOCAL | FileService.MODE_INTERNAL;
    this.localPort = 8080;
    Util.bind(["onFileSystemInit", "onFileSystemRestore", "onWindowLoad", "onFileSystemIDLoad"], this);
    this.loadBound = false;
    if (!FileService.windowLoaded) {
        this.loadBound = true;
        window.addEventListener("load", this.onWindowLoad);
    } else {
        this.localStorageGet("Liquiz-FileSystem-ID", this.onFileSystemIDLoad);
    }
}

FileService.prototype.onWindowLoad = function () {
    console.log("asdf");
    var o = this.localStorageGet("Liquiz-FileSystem-ID", this.onFileSystemIDLoad);
};

FileService.prototype.instantiateChrome = function () {
    chrome.fileSystem.chooseEntry({
        type: "openDirectory",
        suggestedName: "LiquiZ"
    }, this.onFileSystemInit);
};

FileService.prototype.onFileSystemInit = function (entry) {
    var fileID = chrome.fileSystem.retainEntry(entry);
    this.localStorageSet(fileID, "Liquiz-FileSystem-ID");
    this.onFileSystemRestore(entry);
};

FileService.prototype.getFileFS = function (name, docreate, onsuccess, onfail, filesys) {
    var self = this;
    console.log(name);
    var dofail = function (e) {
        console.log("fail", e);
        if (onfail)
            onfail("", false);
    };

    if (typeof name == "string")
        name = name.split("/");
    while (!name[0].length)
        name = name.slice(1);
    filesys || (filesys = this.fileSystem);
    if (!filesys)
        return this.queuedTasks.push(["getFileFS", arguments]);
    console.log(filesys, name);
    var dosucceed = function (e) {
        console.log(e);
        if (name.length == 1) {
            e.file(function (file) {
                var reader = new FileReader();

                reader.onerror = dofail;
                reader.onloadend = function (e) {
                    if (onsuccess)
                        onsuccess(e.target.result, true);
                };

                reader.readAsText(file);
            });
        } else {
            filesys = e;
            self.getFileFS(name.slice(1), docreate, onsuccess, onfail, filesys);
        }

    };
    if (name.length == 1) {
        filesys.getFile(name[0], {
            create: docreate
        }, dosucceed, dofail);
    } else {
        filesys.getDirectory(name[0], {
            create: docreate
        }, dosucceed, dofail);
    }

};

FileService.prototype.writeFileFS = function (name, contents, type, onsuccess, onfail) {
    var dofail = function (e) {
        if (onfail)
            onfail(e);
    };
    var dosuccess = function (e) {
        if (onsuccess)
            onsuccess(chosenFileEntry);
    };
    this.fileSystem.getFile(name, {
        create: true
    }, function (chosenFileEntry) {
        //console.log("success write",chosenFileEntry);
        chrome.fileSystem.getWritableEntry(chosenFileEntry, function (writableFileEntry) {
            writableFileEntry.createWriter(function (writer) {
                writer.onerror = dofail;
                writer.onwriteend = dosuccess;
                chosenFileEntry.file(function (file) {
                    writer.write(new Blob([contents], {
                        type: type || 'text/plain'
                    }));
                });
            }, dofail);
        });

    }, dofail);

};


FileService.prototype.onFileSystemRestore = function (entry) {
    this.fileSystem = entry;
    for (var i = 0, max = this.queuedTasks.length; i < max; i++) {
        var task = this.queuedTasks[i];
        this[task[0]].apply(this, task[1]);
    }
    this.queuedTasks = [];
    //console.log();
    //this.getFileFS("asdf/asdf/supernova.txt", true);
    //this.writeFileFS("/hai/you/supernova.txt", "bingo pig part\n");
};

FileService.prototype.onFileSystemIDLoad = function (o) {
    var id = o["Liquiz-FileSystem-ID"]
    if (id) {
        chrome.fileSystem.restoreEntry(id, this.onFileSystemRestore);
    } else {
        this.instantiateChrome();
    }
};

FileService.prototype.localStorageSet = function (object, id, callback) {
    console.log("storage write", id, object);
    if (this.isChromeApp) {
        chrome.storage.sync.set({
      [id]: object
        }, callback);
    } else {
        localStorage.setItem(id, object);
        callback();
    }
};

FileService.prototype.clear = function () {
    if (this.isChromeApp) {
        chrome.storage.sync.clear();
    } else {
        localStorage.clear();
    }
};

FileService.prototype.localStorageGet = function (id, callback) {
    console.log("storage read", id);
    if (this.isChromeApp) {
        chrome.storage.sync.get(id, callback);
    } else {
        callback({
      [id]: localStorage.getItem(id)
        });
    }
};

FileService.prototype.fetch = function (user, project, request, callback) {
    var xmlhttp = new XMLHttpRequest();
    var url = "";
    if (this.mode & FileService.MODE_SERVER) {
        url += "http://";
    }
    if ((this.mode & FileService.MODE_SERVER)) {
        if (this.mode & FileService.MODE_LOCAL) {
            url += "localhost";
            if (this.localPort != 80)
                url += ":" + this.localPort;
            url += "/";
        } else {
            url += request.domainURL + "/";
        }
    }
    if (this.mode & FileService.MODE_INTERNAL) {
        url += "users/" + user.pathName + "/";
        if (project.pathName) {
            if (!project.isTopLevel)
                url += "projects/";
            url += project.pathName + "/";
        }
        if (request.pathName)
            url += request.pathName + "/";
    }
    url += request.resource;
    console.log(url);
    var self = this;
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            callback(xmlhttp.responseText)
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
};

window.addEventListener("load", FileService.windowOnLoad);

var service = new FileService();


function TempLoad() {
    //test
    var service = new FileService();


    service.fetch({
        pathName: "dov"
    }, {
        pathName: "user_data",
        isTopLevel: true
    }, {
        resource: "dov.json"
    }, function (text) {
        console.log(text);
    });

    service.instantiateChrome();
}