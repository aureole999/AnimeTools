/**
 * Listens for the app launching then creates the window
 *
 * @see http://developer.chrome.com/apps/app.window.html
 */

(function(){

	var animeFilters = new AnimeFilter();
	var savedEntry = null;
	var animeLists = [];
	
	// 创建界面
	function showWindow(openChooseFileDialog) {
		chrome.app.window.create('index.html', {
			id: "mainWin",
			frame: "chrome",
			width: 500,
			height: 500,
			hidden: false
		}, function(createdWindow){
			createdWindow.contentWindow.animeFilters = animeFilters;
			createdWindow.contentWindow.animes = animeLists;
			createdWindow.contentWindow.saveSettings = saveSettings;
			createdWindow.contentWindow.updateAnimeList = updateAnimeList;
			createdWindow.contentWindow.setSavedEntry = setSavedEntry;
			createdWindow.contentWindow.openChooseFileDialog = openChooseFileDialog;
			createdWindow.onClosed.addListener(function(){saveSettings();});
		});
	};

	chrome.app.runtime.onLaunched.addListener(function() {
		showWindow();
	});

	chrome.commands.onCommand.addListener(function(command) {
		if (command === "show-main-window") {
			showWindow();
		} else if (command === "update-anime-list") {
			updateAnimeList(null, animeFilters);
		}
	});
	
	// 保存设置
	function saveSettings() {
		var s = {'animeFilters': animeFilters, 'savedEntry': savedEntry};
		chrome.storage.sync.set(s);
		console.log("Saved Settings");
		console.log(s);
	}
	
	function setSavedEntry(e) {
		savedEntry = e
		saveSettings();
	}
	
	
	// 读取设置
	(function loadSettings() {
		chrome.storage.sync.get(null, function(value) {
			if (value && value.animeFilters) {
				animeFilters = new AnimeFilter(value.animeFilters);
			} else {
				animeFilters = new AnimeFilter();
			}
			// 读取保存路径
			if (value && value.savedEntry) {
				savedEntry = value.savedEntry;
			}
			if (savedEntry) {
				chrome.fileSystem.isRestorable(savedEntry, function(success) {
					if (!success) {
						showWindow(true);
					}
				});
			} else {
				showWindow(true);
			}
			console.log("Loaded Settings");
			console.log(value);
		});
	})();

	jQuery.fn.reverse = [].reverse;
	Date.prototype.format = function(format) //author: meizz
	{
		var o = {
			"M+" : this.getMonth()+1, //month
			"d+" : this.getDate(),    //day
			"h+" : this.getHours(),   //hour
			"m+" : this.getMinutes(), //minute
			"s+" : this.getSeconds(), //second
			"q+" : Math.floor((this.getMonth()+3)/3),  //quarter
			"S" : this.getMilliseconds() //millisecond
		}
		if (/(y+)/.test(format)) 
			format = format.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
		for (var k in o)
			if(new RegExp("("+ k +")").test(format))
				format = format.replace(RegExp.$1, RegExp.$1.length==1 ? o[k] :	("00"+ o[k]).substr((""+ o[k]).length));
		return format;
	};

	// 过滤设置类
	function AnimeFilter(obj) {

		if (!(this instanceof AnimeFilter)) {
			return new AnimeFilter(obj);
		}
		
		// 规则
		this.rules = [];
		// 天数
		this.time = 10;

		if (obj && obj.rules) {
			this.rules = obj.rules;
		}
		if (obj && obj.time) {
			this.time = obj.time;
		}
	}

	// 通过规则判断是否输出为XML
	AnimeFilter.prototype.isMatch = function(anime) {
		var rules = this.rules;
		for (var i in rules) {
			if (typeof(rules[i]) === "string") {
				//if (new RegExp(rules[i]).test(anime.title)) {
				//	return true;
				//}
				var keywords = rules[i].split(" ");
				var match = true;
				for (var i in keywords) {
					if (!new RegExp(keywords[i], "i").test(anime.title)) {
						match = false;
						break;
					}
				}
				if (match) {
					return match;
				}
			}
		}
		return false;
	};

	// 把KTXP网站的数据转换为动画obj
	function parseKTXPHtml(sourceStr, filter) {
		var $doc = $(sourceStr);
		var animes = [];
		var breakFlag = false;
		
		$doc.find('.ttitle').closest('tr').each(function (index, elem){
			var $elem = $(elem);
			var anime = {
				torrent : $elem.find('td.ttitle > a.quick-down').attr('href'),
				publishTime : $elem.find('td:eq(0)').attr('title'),
				title : $elem.find('td.ttitle > a:eq(1)').text(),
			};
			
			//console.log("Find Anime: " + anime.title);
			
			// 过期时间判断
			if (filter != null && animes.length == 0) {
				var pt = anime.publishTime.split(/[\s\:\/]/);
				var animeDate;
				var nowDate = new Date();
				if (pt.length == 5) {
					animeDate = new Date();
					animeDate.setFullYear(pt[0]);
					animeDate.setMonth(pt[1]-1);
					animeDate.setDate(pt[2]);
					animeDate.setHours(pt[3]);
					animeDate.setMinutes(pt[4]);
					animeDate.setSeconds(0);
					animeDate.setMilliseconds(0);
					if (animeDate.getTime() < (nowDate.getTime() - filter.time * 24 * 60 * 60 * 1000)) {
						breakFlag = true;
						return false;
					}
				}
			}

			if (filter == null || filter.isMatch(anime)) {
				console.log("Matched: " + anime.title);
				animes.push(anime);
			}
		});
		if (breakFlag) {
			return null;
		}
		return animes;
	}

	// 转换动画obj到XML格式
	function convertObjToXML(animes) {
		var s = "";
		var now = new Date();
		s += "<?xml version=\"1.0\" encoding=\"utf-8\" ?>";
		s += "<rss version=\"2.0\">";
		s += "<channel>";
		s += "<title><![CDATA[极影动漫]]></title>";
		s += "<language>zh-CN</language>";
		s += "<lastBuildDate>" + now.format("yyyy/MM/dd hh:mm") + "</lastBuildDate>";
		
		for (var i in animes) {
			s += "<item>";
			s += "<title>" + animes[i].title + "</title>";
			s += "<enclosure url=\"http://bt.ktxp.com" + animes[i].torrent + "\" type=\"application/x-bittorrent\"/>";
			s += "</item>";
		}

		s += "</channel></rss>";
		return s;
	}

	function updateAnimeList(url, animeFilters, callback) {
		animeLists.length = 0;
		// 自动更新
		if (url == null || url == "") {
		
			url = "http://bt.ktxp.com/sort-1-(n).html";

			chrome.notifications.clear("refreshstart", function(){});
			chrome.notifications.clear("writecomplete", function(){});
			chrome.notifications.clear("writeerror", function(){});
			chrome.notifications.create("refreshstart", {type:"basic", iconUrl:"ic_launcher.png", title:"", message:"开始更新"}, function(id){console.log("Notifiction Displayed")});
			var i = 1;

			var successCallback = function(data) {
				console.log("Loading URL: " + turl + " Succeed");
				var ani = parseKTXPHtml(data, animeFilters);
				if (ani == null || i >= 50) {
					generateXML(animeLists);
					if (callback && typeof callback === "function") {
						callback();
					}
					return;
				}
				Array.prototype.push.apply(animeLists, ani);
				console.log(animeLists);
				httpGet(url, i++);
			};
			
			var httpGet = (function httpGet(url, pageNum) {
				turl = url.replace(/\(n\)/, pageNum);
				console.log("Loading URL: " + turl);
				$.get(turl, successCallback);
				return httpGet;
			})(url, 1);
		}
		// 手动更新
		else {
			$.get(url).success(function(data){
				animeLists = parseKTXPHtml(data, animeFilters);
				generateXML(animeLists);
				return;
			});
		}
	};

	function generateXML(animes) {
		var writeToXMLFile = function(writableFileEntry) {
			var fileContent = convertObjToXML(animes);
			var errorHandler = function(e) {
				console.log("File Write Error");
				console.log(e);
				chrome.notifications.clear("refreshstart", function(){});
				chrome.notifications.create("writeerror", {type:"basic", iconUrl:"ic_launcher.png", title:"", message:"文件写入失败"}, function(id){});
			};
			writableFileEntry.createWriter(function(writer) {
				writer.onerror = errorHandler;
				writer.onwriteend = function(e) {
					console.log("File Write Complete");
					chrome.notifications.clear("refreshstart", function(){});
					chrome.notifications.create("writecomplete", {type:"basic", iconUrl:"ic_launcher.png", title:"", message:"更新成功"}, function(id){});
				};
				writer.write(new Blob([fileContent], {type: 'text/plain'}));
			}, errorHandler);
		}
		if (savedEntry != null) {
			chrome.fileSystem.isRestorable(savedEntry, function(success) {
				if (success) {
					chrome.fileSystem.restoreEntry(savedEntry, writeToXMLFile);
				} else {
					showWindow(true);
				}
			});
		} else {
			chrome.fileSystem.chooseEntry({type: "saveFile", suggestedName: "animeList.xml"}, function (writableFileEntry) {
				savedEntry = chrome.fileSystem.retainEntry(writableFileEntry);
				// save
				writeToXMLFile(writableFileEntry);
			});
		}

	};
	



})();

