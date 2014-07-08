

function MainController($scope, $http) {

	$scope.settingShow = false;
	$scope.animeFilters = animeFilters;
	$scope.animes = animes;
	
	// 开关设置区
	$scope.toggleSetting = function() {
		$scope.settingShow = !$scope.settingShow;
		return $scope.settingShow;
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
	
	// 保存设置
	$scope.save = saveSettings;
	
	$scope.getHTMLData = function() {
		updateAnimeList($scope.url, $scope.animeFilters, function(){$scope.$apply();});
	};
	
	$scope.selectStoragePath = function() {
		chrome.fileSystem.chooseEntry({type: "saveFile", suggestedName: "animeList.xml"}, function (writableFileEntry) {
			setSavedEntry(chrome.fileSystem.retainEntry(writableFileEntry));
		});
	};
}


