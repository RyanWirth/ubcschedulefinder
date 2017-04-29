var UI = (function($) {
	var aPossibleSchedules = [];
	var aSortedSchedules = [];
	var iCurrentScheduleID = 0;
	var iShowingSchedules = 0;
    
    $(function() {
        // Load in the first schedules
		loadPossibleSchedules();
		
		// Sort and display the schedules
		sortSchedules();
		displaySchedules();
		
		if(aSortedSchedules.length > 0) displaySchedule(aSortedSchedules[0].iID);
        
        $("#schedule-list tbody").on("click", "tr", showSchedule);
		$("#show-more").click(showMoreSchedules);
    });
	
	/**
	 * For sorting schedules while retaining their ID so they may be looked up from aPossibleSchedules.
	 */
	function Schedule(iID, nAverageStartTime, nAverageEndTime, sFirstTermCourses, sSecondTermCourses, nFirstTermHours, nSecondTermHours) {
        this.iID = iID;
		this.nAverageStartTime = nAverageStartTime;
		this.nAverageEndTime = nAverageEndTime;
		this.sFirstTermCourses = sFirstTermCourses;
		this.sSecondTermCourses = sSecondTermCourses;
		this.nFirstTermHours = nFirstTermHours;
		this.nSecondTermHours = nSecondTermHours;
    }
	
	function loadPossibleSchedules() {
		aPossibleSchedules = localStorage.getItem("aPossibleSchedules") != null ? JSON.parse(localStorage.getItem("aPossibleSchedules")) : [];
		
		$("#total").text(aPossibleSchedules.length);
		
		for(var i = 0; i < aPossibleSchedules.length; i++) {
			var aPossibleSchedule = aPossibleSchedules[i];
			
			var aCourseIDs = [];
			var nSumStartTimes = 0;
			var nSumEndTimes = 0;
			var iMeetings = 0;
			var nFirstTermHours = 0;
			var nSecondTermHours = 0;
			var aFirstTermCourses = [];
			var aSecondTermCourses = [];
			var sFirstTermCourses = "";
			var sSecondTermCourses = "";
			
			courses:
			for(var j = 0; j < aPossibleSchedule.length; j++) {
				var oCourseData = aPossibleSchedule[j];
				var sSection = UBCCalendarAPI.getSection(oCourseData[0], oCourseData[1]);
				var aMeetings = sSection.aMeetings;
				
				// Keep track of the sections in each term
				if(sSection.sTerm == "1" || sSection.sTerm == "1-2") {
					if(aFirstTermCourses[sSection.sCourseID] == null) aFirstTermCourses[sSection.sCourseID] = [sSection.sKey];
					else aFirstTermCourses[sSection.sCourseID].push(sSection.sKey);
				}
				if(sSection.sTerm == "2" || sSection.sTerm == "1-2") {
					if(aSecondTermCourses[sSection.sCourseID] == null) aSecondTermCourses[sSection.sCourseID] = [sSection.sKey];
					else aSecondTermCourses[sSection.sCourseID].push(sSection.sKey);
				}
				
				// Keep track of the start/ending time averages
				iMeetings += aMeetings.length;
				for(var k = 0; k < aMeetings.length; k++) {
					var oMeeting = aMeetings[k];
					
					nSumStartTimes += parseFloat(oMeeting.nStartTime);
					nSumEndTimes += parseFloat(oMeeting.nEndTime);
					
					if(sSection.sTerm == "1" || sSection.sTerm == "1-2") nFirstTermHours += (parseFloat(oMeeting.nEndTime) - parseFloat(oMeeting.nStartTime));
					if(sSection.sTerm == "2" || sSection.sTerm == "1-2") nSecondTermHours += (parseFloat(oMeeting.nEndTime) - parseFloat(oMeeting.nStartTime));
				}
			}
			
			// Parse the course arrays into strings
			for(var key in aFirstTermCourses) {
				sFirstTermCourses += key + " (";
				for(var j = 0; j < aFirstTermCourses[key].length; j++) sFirstTermCourses += aFirstTermCourses[key][j] + ", ";
				sFirstTermCourses = sFirstTermCourses.substr(0, sFirstTermCourses.length - 2) + "), ";
			}
			
			for(var key in aSecondTermCourses) {
				sSecondTermCourses += key + " (";
				for(var j = 0; j < aSecondTermCourses[key].length; j++) sSecondTermCourses += aSecondTermCourses[key][j] + ", ";
				sSecondTermCourses = sSecondTermCourses.substr(0, sSecondTermCourses.length - 2) + "), ";
			}
			
			// Strip off the last ", " and replace dashes with spaces
			sFirstTermCourses = sFirstTermCourses.substr(0, sFirstTermCourses.length - 2).replace(/-/g, ' ');
			sSecondTermCourses = sSecondTermCourses.substr(0, sSecondTermCourses.length - 2).replace(/-/g, " ");
			
			var sSchedule = new Schedule(i, nSumStartTimes / iMeetings, nSumEndTimes / iMeetings, sFirstTermCourses, sSecondTermCourses, nFirstTermHours, nSecondTermHours);
			aSortedSchedules.push(sSchedule);
		}
	}
	
	function sortSchedules() {
		aSortedSchedules.sort(sortSchedules_byMostBalanced);
	}
	
	function sortSchedules_byMostBalanced(sSchedule1, sSchedule2) {
		var nDiff1 = Math.abs(sSchedule1.nFirstTermHours - sSchedule2.nSecondTermHours);
		var nDiff2 = Math.abs(sSchedule2.nFirstTermHours - sSchedule2.nSecondTermHours);
		
		return nDiff1 - nDiff2;
	}
	
	function sortSchedules_bySmartSort(sSchedule1, sSchedule2) {
		var nMostBalanced = sortSchedules_byMostBalanced(sSchedule1, sSchedule2);
		
		if(nMostBalanced == 0) {
			// Both are equally balanced, go by shortest day
			return sortSchedules_byShortestDay(sSchedule1, sSchedule2);
		} else return nMostBalanced;
	}
	
	function sortSchedules_byLatestStartTime(sSchedule1, sSchedule2) {
		return sSchedule2.nAverageStartTime - sSchedule1.nAverageStartTime;
	}
	
	function sortSchedules_byEarliestEndTime(sSchedule1, sSchedule2) {
		return sSchedule1.nAverageEndTime - sSchedule2.nAverageEndTime;
	}
	
	function sortSchedules_byShortestDay(sSchedule1, sSchedule2) {
		var nLength1 = sSchedule1.nAverageEndTime - sSchedule1.nAverageStartTime;
		var nLength2 = sSchedule2.nAverageEndTime - sSchedule2.nAverageStartTime;
		
		return nLength2 - nLength1;
	}
	
	function displaySchedules() {
		clearSchedules();
		
		displayNextSchedules(10);
	}
	
	function displayNextSchedules(iSchedulesToShow) {
		var iCurrentIndex = iShowingSchedules;
		var iLastIndex = iShowingSchedules += iSchedulesToShow;
		
		if(iLastIndex >= aSortedSchedules.length) iLastIndex = aSortedSchedules.length;
		
		for(var i = iCurrentIndex; i < iLastIndex; i++) {
			var sSchedule = aSortedSchedules[i];
			
			addScheduleRowToList(sSchedule.iID, (i + 1), convertDecimalTimeToString(sSchedule.nAverageStartTime), convertDecimalTimeToString(sSchedule.nAverageEndTime),
								sSchedule.sFirstTermCourses, sSchedule.sSecondTermCourses);
		}
		
		iShowingSchedules = iLastIndex;
		
		updateShowMoreText();
	}
	
	function addScheduleRowToList(iScheduleID, iOrder, sAverageStartTime, sAverageEndTime, sFirstTermCourses, sSecondTermCourses) {
		$("#schedule-list tbody").append('<tr id="schedule-row-' + iScheduleID + '"' + (iOrder % 2 == 1 ? ' class="odd"' : '') + '>\
											<td>' + iOrder        + '</td>\
										 	<td>' + sAverageStartTime  + '</td>\
										 	<td>' + sAverageEndTime    + '</td>\
										 	<td>' + sFirstTermCourses  + '</td>\
										 	<td>' + sSecondTermCourses + '</td>\
										 </tr>');
	}
	
	function clearSchedules() {
		$("#schedule-list tbody").empty();
	}
	
	function displaySchedule(iScheduleID) {
		// Deselect the previous schedule
		$("#schedule-row-" + iCurrentScheduleID).removeClass("selected");
		
		// Highlight the new schedule
		iCurrentScheduleID = iScheduleID;
		$("#schedule-row-" + iCurrentScheduleID).addClass("selected");
		
		// Clear the previous schedule elements
		clearScheduleSections();
		
		// Add the courses of the new schedule to the timeline
		var aSchedule = aPossibleSchedules[iCurrentScheduleID];
		for(var i = 0; i < aSchedule.length; i++) {
			var oCourseData = aSchedule[i];
			var sCourseID = oCourseData[0];
			var sKey = oCourseData[1];
			var sSection = UBCCalendarAPI.getSection(sCourseID, sKey);
			var aMeetings = sSection.aMeetings;
			
			for(var j = 0; j < aMeetings.length; j++) {
				var mMeeting = aMeetings[j];
				
				var sTerm      = mMeeting.sTerm;
				var sDay       = mMeeting.sDay.toLowerCase();
				var sStartTime = convertDecimalTimeToString(mMeeting.nStartTime);
				var sEndTime   = convertDecimalTimeToString(mMeeting.nEndTime);
				var sRoom      = mMeeting.sBuildingCode + " " + mMeeting.sRoomNumber;
				
				addMeetingToDay(sTerm, sDay, sCourseID.replace("-", " "), sKey, sRoom, sStartTime, sEndTime);
			}
		}
		
		realignScheduleItems();
	}
	
	function clearScheduleSections() {
		clearScheduleDay("mon");
		clearScheduleDay("tue");
		clearScheduleDay("wed");
		clearScheduleDay("thu");
		clearScheduleDay("fri");
	}
	
	function clearScheduleDay(sDay) {
		$("#term-1 #list-" + sDay).empty();
		$("#term-2 #list-" + sDay).empty();
	}
	
	function addMeetingToDay(sTerm, sDay, sCourseID, sKey, sRoom, sStartTime, sEndTime) {
		if(sTerm == "1" || sTerm == "1-2") addMeetingToDay_forTerm(1, sDay, sCourseID, sKey, sRoom, sStartTime, sEndTime);
		if(sTerm == "2" || sTerm == "1-2") addMeetingToDay_forTerm(2, sDay, sCourseID, sKey, sRoom, sStartTime, sEndTime);
	}
	
	function addMeetingToDay_forTerm(iTerm, sDay, sCourseID, sKey, sRoom, sStartTime, sEndTime) {
		$("#term-" + iTerm + " #list-" + sDay).append('<li data-start="' + sStartTime + '" data-end="' + sEndTime + '">\
                                		<div class="contents">\
                                    		<div class="title">' + sCourseID + ' ' + sKey + '</div>\
                                    		<div class="room">' + sRoom + '</div>\
                                		</div>\
                            		</li>');
	}
	
	function showSchedule() {
		var sRowID = $(this).attr("id");
		var iScheduleID = parseInt(sRowID.replace("schedule-row-", ""));
		
		displaySchedule(iScheduleID);
		
		// Smooth scroll to the list
		$('html, body').animate({
        	scrollTop: $("#term-1").offset().top
    	}, 1000);
	}
	
	function showMoreSchedules() {
		displayNextSchedules(10);
	}
	
	function updateShowMoreText() {
		$("#show-more td").text("Showing Top "+iShowingSchedules+" of "+addCommas(aPossibleSchedules.length)+". Click to View 10 More");
	}
	
	/**
	 * Converts a time given as a number (eg. 14.5) into a formatted 24-hour time string (eg. 14:30)
	 *
	 * @param nTime The time as a decimal
	 * @return      The time as a string
	 */
	function convertDecimalTimeToString(nTime) {
		var iHour = Math.floor(nTime);
		var iMinute = Math.floor((nTime - iHour) * 60);
		var sTime = (iHour < 10 ? "0" : "") + iHour + ":" + (iMinute < 10 ? "0" : "") + iMinute;
		
		return sTime;
	}
    
    function realignScheduleItems() {
		realignScheduleItems_forTerm(1);
		realignScheduleItems_forTerm(2);
    }
	
	function realignScheduleItems_forTerm(iTerm) {
        $("#term-"+iTerm+" div.ui-schedule-events li").each(function() {
            var aStartTime = $(this).data("start").split(":");
            var aEndTime = $(this).data("end").split(":");
        
            var nStartTime = parseInt(aStartTime[0]) + parseInt(aStartTime[1]) / 60;
            var nEndTime = parseInt(aEndTime[0]) + parseInt(aEndTime[1]) / 60;
            
            var nDuration = nEndTime - nStartTime;
            var nHeight = nDuration * 50 - 4;
            
            var nYPos = (nStartTime - 8) * 50 + 50;
            
            $(this).css("top", nYPos + "px");
            $(this).css("height", nHeight + "px");
        });
	}
    
    /**
     * Adds commas to the given number and returns it as a string.
     *
     * @param nStr The number to format
     * @return     A string with the formatted number
     */
    function addCommas(nStr) {
        nStr += '';
        x = nStr.split('.');
        x1 = x[0];
        x2 = x.length > 1 ? '.' + x[1] : '';
        var rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
    }
    
})(jQuery);