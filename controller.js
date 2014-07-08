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
AnimeFilter.prototype.isMatch = function(anime)
{
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

function MainController($scope, $http) {

	$scope.settingShow = false;
	$scope.url = "http://bt.ktxp.com/sort-1-(n).html";
	$scope.savedEntry;
	
	// 加载网站数据
	$scope.getHTMLData = function() {
		var url = $scope.searchResultUrl;
		
		// 自动更新
		if (url == null || url == "") {
			chrome.notifications.create("refreshstart", {type:"basic", iconUrl:"ic_launcher.png", title:"", message:"开始更新"}, function(id){console.log("notify")});
			var i = 1;
			
			$scope.animes = [];

			var httpGet = function(url, pageNum) {
				url = $scope.url.replace(/\(n\)/, pageNum);
				$http.get(url).success(successCallback);
			}

			var successCallback = function(data) {
				var animes = parseKTXPHtml(data, $scope.animeFilters);
				
				if (animes == null || i >= 50) {
					$scope.generateXML();
					return;
				}
				$scope.animes = $scope.animes.concat(animes);
				
				httpGet(url, i++);
			};
			
			httpGet(url, i++);

		}
		// 手动更新
		else {
			$scope.searchResultUrl = "";
			$http.get(url).success(function(data){
				$scope.animes = parseKTXPHtml(data);
			});
		}

	};

	var errorHandler = function(e) {
		console.log("file write error");
		console.log(e);
	};

	// 保存XML文件
	$scope.generateXML = function() {
		var writeToXMLFile = function(writableFileEntry) {
			var fileContent = convertObjToXML($scope.animes);
			writableFileEntry.createWriter(function(writer) {
				writer.onerror = errorHandler;
				writer.onwriteend = function(e) {
					console.log("write complete");
					chrome.notifications.create("writecomplete", {type:"basic", iconUrl:"ic_launcher.png", title:"", message:"更新成功"}, function(id){console.log("notify")});
				};
				writer.write(new Blob([fileContent], {type: 'text/plain'}));
			}, errorHandler);
		}
		if ($scope.savedEntry != null) {
			chrome.fileSystem.isRestorable($scope.savedEntry, function(success) {
				if (success) {
					chrome.fileSystem.restoreEntry($scope.savedEntry, writeToXMLFile);
				} else {
					chrome.fileSystem.chooseEntry(
						{
							type : "saveFile", 
							suggestedName : "animeList.xml",
						}, 
						function (writableFileEntry) {
							$scope.savedEntry = chrome.fileSystem.retainEntry(writableFileEntry);
							$scope.save();
							writeToXMLFile(writableFileEntry);
						}
					);
				}
			});
			
		} else {
			chrome.fileSystem.chooseEntry(
				{
					type : "saveFile", 
					suggestedName : "animeList.xml",
				}, 
				function (writableFileEntry) {
					$scope.savedEntry = chrome.fileSystem.retainEntry(writableFileEntry);
					$scope.save();
					writeToXMLFile(writableFileEntry);
				}
			);
		}
	};

	// 开关设置区
	$scope.toggleSetting = function() {
		$scope.settingShow = !$scope.settingShow;
	};

	// 加载设置
	$scope.load = function(value) {
		console.log("sync value : ");
		console.log(value);
		if (value && value.animeFilters) {

			$scope.animeFilters = new AnimeFilter(value.animeFilters);
			// 数据清空
			// $scope.animeFilters = new AnimeFilter();
		} else {
			$scope.animeFilters = new AnimeFilter();
		}

		if (value && value.savedEntry) {
			$scope.savedEntry = value.savedEntry;
		}
	};

	// 保存设置
	$scope.save = function() {
		chrome.storage.sync.set({'animeFilters': $scope.animeFilters, 'savedEntry': $scope.savedEntry});
	};
	
	// 添加新规则
	$scope.addRule = function() {
		if ($scope.animeFilters != null) {
			$scope.animeFilters.rules.push("");
		}
	};

	// 删除规则
	$scope.deleteRule = function(ruleIndex) {
		if ($scope.animeFilters != null) {
			$scope.animeFilters.rules.splice(ruleIndex, 1);
		}
	};

	$scope.hideWindow = function() {
		chrome.app.window.current().hide();
	}

	// 加载时同步读取设置
	// Notice that chrome.storage.sync.get is asynchronous
	chrome.storage.sync.get(null, function(value) {
	// The $apply is only necessary to execute the function inside Angular scope
		$scope.$apply(function() {
			$scope.load(value);
		});
	});

}

