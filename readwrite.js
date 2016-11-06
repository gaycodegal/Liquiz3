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
    if (!onfail)
        onfail = FileService.fallback;

    var self = this;
    console.log(name);
    var dofail = function (e) {
        console.log("fail", e);
        if (onfail)
            onfail("", false);
    };

    if (typeof name == "string") // /docs//blog/a.txt
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

FileService.fallback = function () {
    console.error("File not fountd!");
};

FileService.prototype.writeFileFS = function (name, contents, type, onsuccess, onfail, filesys) {
    if (!onfail)
        onfail = FileService.fallback;

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
        return this.queuedTasks.push(["writeFileFS", arguments]);

    console.log("WRITING", filesys, name, contents);

    var dosucceed = function (e) {
        console.log(e);
        if (name.length == 1) {
            chrome.fileSystem.getWritableEntry(e, function (writableFileEntry) {
                writableFileEntry.createWriter(function (writer) {
                    writer.onerror = dofail;
                    writer.onwriteend = onsuccess;
                    writableFileEntry.file(function (file) {
                        writer.write(new Blob([contents], {
                            type: type || 'text/plain'
                        }));
                    });
                }, dofail);
            });
        } else {
            filesys = e;
            self.writeFileFS(name.slice(1), contents, type, onsuccess, onfail, filesys);
        }

    };
    if (name.length == 1) {
        filesys.getFile(name[0], {
            create: true
        }, dosucceed, dofail);
    } else {
        filesys.getDirectory(name[0], {
            create: true
        }, dosucceed, dofail);
    }
};


FileService.prototype.onFileSystemRestore = function (entry) {
    this.fileSystem = entry;
    for (var i = 0, max = this.queuedTasks.length; i < max; i++) {
        var task = this.queuedTasks[i];
        this[task[0]].apply(this, task[1]);
    }
    this.queuedTasks = [];
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

/**
Fetch the contents of a file from the server.
@param {string} request The path of the request excluding domain name.
@example "dov/user/file.jsp"
@param {Function(requestText, wasSuccessful)} callback
@param {string} server The domain name and protocol of the server or false to go local.
Note: requires ending slash.
@example "http://www.liquiz.com/" or false
@param {Function(requestText, wasSuccessful)} onfail
*/
FileService.prototype.fetch = function (request, callback, server, onfail) {
    var xmlhttp = new XMLHttpRequest();
    var self = this;

    if (!server)
        return this.getFileFS(request, false, callback, onfail);

    var url = server + request;
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            callback(xmlhttp.responseText)
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
};

/**
Write the contents of a file to the server, get back a response.
@param {string} request The path of the request excluding domain name.
@example "dov/user/file.jsp"
@param {string} filecontents The contents of the file to send.
@param {string} fileblobtype The type of the data being sent
@example "text/plain"
@param {Function(requestText, wasSuccessful)} callback
@param {string} server The domain name and protocol of the server or false to go local.
Note: requires ending slash.
@example "http://www.liquiz.com/" or false
@param {Function(requestText, wasSuccessful)} onfail
*/
FileService.prototype.write = function (filename, filecontents, fileblobtype, callback, server, onfail) {
    if (!filename) return;
    if (!fileblobtype) fileblobtype = "text/plain";

    var xmlhttp = new XMLHttpRequest();
    var self = this;

    if (!server)
        return this.writeFileFS(filename, filecontents, fileblobtype, callback, onfail);

    var url = server + filename;
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            callback(xmlhttp.responseText)
        }
    };

    var formData = new FormData();
    formData.append("filename", filename);
    if (filecontents)
        formData.append("filecontents", filecontents);
    else
        formData.append("deletethisfile", filecontents);
    formData.append("fileblobtype", fileblobtype);
    xmlhttp.open("POST", url, true);
    xmlhttp.send(formData);
};

window.addEventListener("load", FileService.windowOnLoad);

var service = new FileService();

function TestLoad() {
    //test
    

    service.fetch("test/index.html", function (filecontents) {
        console.log("YAY", filecontents);
    }, "http://bluecode.altervista.org/"); // global

    service.fetch("test/index.html", function (filecontents) {
        console.log("YAY", filecontents);
    }); // local

    service.write("test/index2.html", "testing testing\n", "text/plain", function () {
        console.log("YAY");
    }, "http://bluecode.altervista.org/"); // global

    service.write("test/index2.html", "testing testing\n", "text/html", function () {
        console.log("YAY");
    }); // local
}

TestLoad();