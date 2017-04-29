var UI = (function ($) {
    var aCourses = [];
    var bSchedulesGenerated = false;
    var bCoursesModified = false;
    var iSchedulesGenerated = 0;
    var scCurrentCourse = null;

    $(function () {
        // Load the departments
        UBCCalendarAPI.getDepartments(function () {});

        // Set up all the click handlers
        $("#course-list tbody").on("click", "tr", showCourseModalWindow);
        $("#course #modal-close").click(hideCourseModalWindow);
        $("#course .ui-modal-tint").click(hideCourseModalWindow);
        $("#course #modal-delete").click(removeCourseInModalWindow);

        $(".ui-content-text-header-search").bind("input", searchInputChanged);
        $(".ui-content-text-header-search").focusin(searchInputChanged);

        $(".search-results").on("click", ".search-result", selectCourse);

        $("#section-list tbody").on("click", "input", toggleSection);
        
        $(".ui-footer-start-generation").click(findSchedules);
        
        // Configure the Find Schedules button
        refreshGenerationState();
        
        // Load in all the past courses
        loadCourses();
    });
    
    /**
     * Retrieves the generation status variables from localStorage and updates the footer button
     */
    function refreshGenerationState() {
        bSchedulesGenerated = localStorage.getItem("bSchedulesGenerated") != null ? (localStorage.getItem("bSchedulesGenerated") == "false" ? false : true) : false;
        bCoursesModified = localStorage.getItem("bCoursesModified") != null ? (localStorage.getItem("bCoursesModified") == "false" ? false : true) : false;
        iSchedulesGenerated = localStorage.getItem("iSchedulesGenerated") != null ? parseInt(localStorage.getItem("iSchedulesGenerated")) : 0;
        
        if(!bSchedulesGenerated) displayFooterMessage("Click to Find Schedules", false);
		else {
			updateFindSchedulesStatus(1, -1);
			if(!bCoursesModified) displayFooterMessage("Found " + iSchedulesGenerated + " Schedules, Click to View", true);
			else displayFooterMessage("Courses Modified, Click to Find Schedules", true);
		}
    }
    
    /**
     * Saves the generation status variables to localStorage and refreshes the generation state.
     */
    function saveGenerationState(bSchedulesGenerated_t, bCoursesModified_t, iSchedulesGenerated_t) {
        bSchedulesGenerated = bSchedulesGenerated_t;
        bCoursesModified = bCoursesModified_t;
        iSchedulesGenerated = iSchedulesGenerated_t;
        
        localStorage.setItem("bSchedulesGenerated", bSchedulesGenerated);
        localStorage.setItem("bCoursesModified", bCoursesModified);
        localStorage.setItem("iSchedulesGenerated", iSchedulesGenerated);
        
        refreshGenerationState();
    }
    
    /**
     * Loads the list of courses (if they exist) from localStorage.
     */
    function loadCourses() {
        var aCourseIDs = localStorage.getItem("aCourseIDs") != null ? JSON.parse(localStorage.getItem("aCourseIDs")) : [];
        for(var i = 0; i < aCourseIDs.length; i++) requestAddCourseToList(aCourseIDs[i]);
    }

    /**
     * Saves the selected courses to localStorage.
     */
    function saveCourses() {
        var aCourseIDs = [];
        for(var i = 0; i < aCourses.length; i++) aCourseIDs.push(aCourses[i].sCourseID);
        
        localStorage.setItem("aCourseIDs", JSON.stringify(aCourseIDs));
    }

    /**
     * Loads the appropriate search results given the search input's new value.
     *
     * If four or more characters are entered, assume it composes a department key (eg. "CPSC")
     * and an incomplete course key and load those courses.
     *
     * If at least one character is entered, assume it composes an incomplete department key
     * and load those departments.
     *
     * If no characters are entered, show a default prompt instead.
     */
    function searchInputChanged() {
        var sSearchTerm = $(this).val().trim();

        if (sSearchTerm.length >= 4) {
            // Interpret the current value as a department key
            var sDepartmentKey = sSearchTerm.substring(0, 4).toUpperCase();
            var sCourseKey = sSearchTerm.substring(4).trim();

            UBCCalendarAPI.getCoursesStartingWith(sSearchTerm, sDepartmentKey, sCourseKey, 6, addSearchResultsCourses);
        } else
        if (sSearchTerm.length >= 1) UBCCalendarAPI.getDepartmentsStartingWith(sSearchTerm.toUpperCase(), 6, addSearchResultsDepartments);
        else {
            clearSearchResults();
            addSearchResult('Search for a course', 'For example, "CPSC 110".');
        }
    }

    /**
     * Called when the department loading call returns, giving an array of Departments to
     * show as search results.
     */
    function addSearchResultsDepartments(aDepartments) {
        clearSearchResults();
        for (var i = 0; i < aDepartments.length; i++) addSearchResult(aDepartments[i].sKey, aDepartments[i].sTitle);
        if (aDepartments.length == 0) addSearchResult("No departments found", "Please try another.");
    }

    /**
     * Called when the course loading call returns, giving an array of Courses to show as
     * search results.
     *
     * @param sDepartmentKey The department key of the courses
     * @param sSearchTerm    The original search term, used for ignoring stale results
     * @param aCourses       The array of Courses to show
     */
    function addSearchResultsCourses(sDepartmentKey, sSearchTerm, aCourses) {
        if ($(".ui-content-text-header-search").val().trim() != sSearchTerm) return;

        clearSearchResults();
        for (var i = 0; i < aCourses.length; i++) addSearchResult(sDepartmentKey + " " + aCourses[i].sKey, aCourses[i].sTitle);
        if (aCourses.length == 0) addSearchResult("No courses found", "Please try another.");
    }

    /**
     * Empties the search results container.
     */
    function clearSearchResults() {
        $(".search-results").empty();
    }

    /**
     * Adds a new row to the search results container consisting of the passed data.
     *
     * @param sTitle       The title to be used for the result
     * @param sDescription The description to be used for the result
     */
    function addSearchResult(sTitle, sDescription) {
        $(".search-results").append('<li class="search-result" data-key="' + sTitle + '">' + sTitle + "<br/><span>" + sDescription + "</span></</li>");
    }

    /**
     * Called when a search result is clicked. Requests the course's section data from
     * the UBCCalendarAPI and adds the course to the table.
     */
    function selectCourse() {
        var sKey = $(this).data("key");
        var aStringData = sKey.split(" ");
        
        // If this isn't a complete course ID, i=gnore it (ie. the user clicked on a department result, not a course result)
        if (aStringData.length != 2) return;
		
		// Indicate that the course list has changed
		saveGenerationState(bSchedulesGenerated, true, iSchedulesGenerated);
        
        requestAddCourseToList(aStringData[0] + "-" + aStringData[1]);

        // Clear the search bar
        $(".ui-content-text-header-search").val("");
    }
    
    /**
     * Adds a placeholder row for this course and starts loading it using the UBCCalendarAPI.
     *
     * @param sCourseID The course to add to the main table.
     */
    function requestAddCourseToList(sCourseID) {
        // Add a dummy row to show that this row is loading
        addPlaceholderRowToList(sCourseID);

        // Start loading the section data
        UBCCalendarAPI.getSections(addCourseToList, sCourseID);
    }

    /**
     * Adds a dummy row to the main data table.
     *
     * @param sCourseID The course ID (eg. "CPSC-110") to identify the new row by
     */
    function addPlaceholderRowToList(sCourseID) {
        $("#course-list tbody").append('<tr id="course-row-' + sCourseID + '"' + (aCourses.length % 2 == 1 ? ' class="odd"' : '') + '>\
                            <td id="course-name">Loading...</td>\
                            <td id="course-title"></td>\
                            <td id="course-terms"></td>\
                            <td id="course-section-types"></td>\
                            <td id="course-possibilities"></td>\
                        </tr>');
    }

    /**
     * Called when the request for a certain course's sections is completed. Calculates
     * the possible combinations of the course's sections and adds the course to the table.
     *
     * @param scSectionContainer A SectionContainer object containing the course's sections
     */
    function addCourseToList(scSectionContainer) {
        // If this course is already added, skip it
        for (var i = 0; i < aCourses.length; i++)
            if (aCourses[i].sCourseID == scSectionContainer.sCourseID) return;

        // Add this course ID to the list
        aCourses.push(scSectionContainer);

        // Update the data
        updateCourseInList(scSectionContainer);
        
        // Save the new list
        saveCourses();
    }
    
    /**
     * Removes the given SectionContainer from the main table and recalculates the total number of possibilities.
     *
     * @param scSectionContainer The course SectionContainer to remove from the table
     */
    function removeCourseFromList(scSectionContainer) {
        for(var i = 0; i < aCourses.length; i++)
            if(aCourses[i] == scSectionContainer) aCourses.splice(i, 1);
        
        // Remove the row from the table
        var sRowID = "#course-row-" + scSectionContainer.sCourseID;
        $(sRowID).remove();
        
        // Update the oddity of the remaining rows
        $("#course-list tbody tr").each(function( index ) {
            if(index % 2 == 1) $(this).addClass("odd");
            else $(this).removeClass("odd");
        });
		
		// Indicate the course list has changed
		saveGenerationState(bSchedulesGenerated, true, iSchedulesGenerated);
        
        // Update the counter in the footer
        updateTotalPossibilities();
        
        // Delete this course's section data from the API
        UBCCalendarAPI.deleteCourseFromCache(scSectionContainer.sCourseID);
        
        // Save the new list
        saveCourses();
    }
    
    /**
     * Recalculates the number of possibilities from the selected sections and updates the row in the main table.
     *
     * @param scSectionContainer The course SectionContainer to update data for
     */
    function updateCourseInList(scSectionContainer) {
        var aStringData = scSectionContainer.sCourseID.split("-");
        var sDepartmentKey = aStringData[0];
        var sCourseKey = aStringData[1];
        var bHasTerm1 = false;
        var bHasTerm2 = false;
        var bHasTerm1_2 = false;
        var sSectionTypes = "";
        var iPossibilitiesTerm1 = 1;
        var iPossibilitiesTerm2 = 1;
        var iPossibilitiesTerm1_2 = 1;

        for (var i = 0; i < scSectionContainer.aSections.length; i++) {
            var sActivity = scSectionContainer.aSections[i][0].sActivity;
            var iTerm1 = 0;
            var iTerm2 = 0;
            var iTerm1_2 = 0;

            for (var j = 0; j < scSectionContainer.aSections[i].length; j++) {
                // If this section is not 
                if (scSectionContainer.aSections[i][j].bSelected == false) continue;

                var sTerm = scSectionContainer.aSections[i][j].sTerm;
                if (sTerm == "1") iTerm1++;
                else if (sTerm == "2") iTerm2++;
                else if (sTerm == "1-2") iTerm1_2++;
            }

            // Keep track of the current number of possibilities
            bHasTerm1 = bHasTerm1 || (iTerm1 > 0);
            bHasTerm2 = bHasTerm2 || (iTerm2 > 0);
            bHasTerm1_2 = bHasTerm1_2 || (iTerm1_2 > 0);
            iPossibilitiesTerm1 *= (iTerm1 > 0 ? iTerm1 : 1);
            iPossibilitiesTerm2 *= (iTerm2 > 0 ? iTerm2 : 1);
            iPossibilitiesTerm1_2 *= (iTerm1_2 > 0 ? iTerm1_2 : 1);
			
			if(iTerm1_2 == 0 && iTerm1 == 0 && iTerm2 != 0) {
				// This activity type has sections in term 2 but not term 1
				iPossibilitiesTerm1 = 0;
			} else
			if(iTerm1_2 == 0 && iTerm1 != 0 && iTerm2 == 0) {
				// Ditto, but for term 2
				iPossibilitiesTerm2 = 0;
			}

            if (iTerm1 > 0 || iTerm2 > 0 || iTerm1_2 > 0) {
                // Format the section types descriptor
                sSectionTypes += sActivity + " (";
                if (bHasTerm1_2) sSectionTypes += iTerm1_2;
                else if (bHasTerm1 && bHasTerm2) sSectionTypes += iTerm1 + "/" + iTerm2;
                else if (bHasTerm1) sSectionTypes += iTerm1;
                else sSectionTypes += iTerm2;
                sSectionTypes += "), ";
            }
        }

        // Remove trailing ", "
        sSectionTypes = sSectionTypes.substr(0, sSectionTypes.length - 2);
        if(sSectionTypes.length == 0) sSectionTypes = "None";

        // Format the term column: 1/2 or 1 or 2, depending on the availability of sections
        var sTerms = bHasTerm1_2 ? "1-2" : ((bHasTerm1 && bHasTerm2) ? "1/2" : (bHasTerm1 ? "1" : (bHasTerm2 ? "2" : "")));

        // Calculate the total number of possibilities
        var iPossibilities = (bHasTerm1 ? iPossibilitiesTerm1 : 0) + (bHasTerm2 ? iPossibilitiesTerm2 : 0) + (bHasTerm1_2 ? iPossibilitiesTerm1_2 : 0);
        scSectionContainer.iPossibilities = iPossibilities;

        // If the row doesn't have a placeholder in the table yet, add one
        var sRowID = "#course-row-" + scSectionContainer.sCourseID;
        if ($(sRowID).length == 0) addPlaceholderRowToList();

        // Update the row's data
        $(sRowID + " #course-name").text(sDepartmentKey + " " + sCourseKey);
        $(sRowID + " #course-title").text(scSectionContainer.sTitle);
        $(sRowID + " #course-terms").text(sTerms);
        $(sRowID + " #course-section-types").text(sSectionTypes);
        $(sRowID + " #course-possibilities").text(iPossibilities);

        updateTotalPossibilities();
    }
    
    /**
     * Recalculates the total number of possibilities of all courses and updates the counter
     * in the footer.
     */
    function updateTotalPossibilities() {
        // Update the total possibilities counter in the footer
        var iTotalPossibilities = 1;
        for (var i = 0; i < aCourses.length; i++) iTotalPossibilities *= (aCourses[i].iPossibilities > 0 ? aCourses[i].iPossibilities : 1);
        $("#course-list tfoot tr td#total").text(aCourses.length == 0 ? 0 : addCommas(iTotalPossibilities));
    }

    /**
     * Called when a course in the main table is clicked. Displays the modal window and
     * loads the course's sections.
     */
    function showCourseModalWindow() {
        $("#course").css("visibility", "visible");
        $("#course").animate({
            opacity: 1
        }, 150);

        var sCourseName = $(this).find("#course-name").text();
        var aStringData = sCourseName.split(" ");

        // Update the modal window title to be the course name
        $("#course .ui-modal-window-header-title").text(sCourseName);

        // Clear the section list
        $("#section-list tbody").empty();

        // Load the sections
        UBCCalendarAPI.getSections(addSectionsToModalWindow, aStringData[0] + "-" + aStringData[1]);
    }
    
    /**
     * Called when the delete button in the modal window is clicked. Deletes the course from the table
     * and closes the modal window.
     */
    function removeCourseInModalWindow() {
        if(scCurrentCourse == null) return;
        
        removeCourseFromList(scCurrentCourse);
        scCurrentCourse = null;
        
        hideCourseModalWindow();
    }

    /**
     * Hides the course modal window.
     */
    function hideCourseModalWindow() {
        // Update the course we just edited in the table
        if (scCurrentCourse != null) updateCourseInList(scCurrentCourse);
        scCurrentCourse = null;
        
        // Save the changes in the UBCCalendarAPI
        UBCCalendarAPI.saveCache();

        $("#course").css("visibility", "hidden");
        $("#course").css("opacity", "0");
    }

    /**
     * Adds all of the course sections to the course modal window.
     *
     * @param scSectionContainer A SectionContainer object describing the course's sections
     */
    function addSectionsToModalWindow(scSectionContainer) {
        scCurrentCourse = scSectionContainer;
        var odd = true;
        for (var i = 0; i < scSectionContainer.aSections.length; i++) {
            for (var j = 0; j < scSectionContainer.aSections[i].length; j++) {
                var sStatus = scSectionContainer.aSections[i][j].sStatus;
                var sKey = scSectionContainer.aSections[i][j].sKey;
                var sActivity = scSectionContainer.aSections[i][j].sActivity;
                var sTerm = scSectionContainer.aSections[i][j].sTerm;
                var bSelected = scSectionContainer.aSections[i][j].bSelected;

                var aMeetingSlots = getMeetingSlotsFromSection(scSectionContainer.aSections[i][j]);

                odd = !odd;
                
                $("#section-list tbody").append('<tr'+(odd?' class="odd"':'')+'>\
                                                <td><input data-key="' + sKey + '" ' + (bSelected ? "checked " : "") + 'type="checkbox" /></td>\
                                                <td>' + sStatus + '</td>\
                                                <td>' + sKey + '</td>\
                                                <td>' + sActivity + '</td>\
                                                <td>' + aMeetingSlots[0][0] + '</td>\
                                                <td>' + aMeetingSlots[0][3] + '</td>\
                                                <td>' + aMeetingSlots[0][1] + '</td>\
                                                <td>' + aMeetingSlots[0][2] + '</td>\
                                            </tr>');

                // If there are additional meeting slots, add them as separate rows to the table
                for (var k = 1; k < aMeetingSlots.length; k++) {
                    $("#section-list tbody").append('<tr'+(odd?' class="odd"':'')+'>\
                                                    <td></td>\
                                                    <td></td>\
                                                    <td></td>\
                                                    <td></td>\
                                                    <td>' + aMeetingSlots[k][0] + '</td>\
                                                    <td>' + aMeetingSlots[k][3] + '</td>\
                                                    <td>' + aMeetingSlots[k][1] + '</td>\
                                                    <td>' + aMeetingSlots[k][2] + '</td>\
                                                </tr>');
                }
            }
        }
    }

    /**
     * Called when an input checkbox of a section is clicked. Toggles the selected
     * status of the clicked section inside the modal window.
     */
    function toggleSection() {
        for (var i = 0; i < scCurrentCourse.aSections.length; i++) {
            for (var j = 0; j < scCurrentCourse.aSections[i].length; j++) {
                // Check each section
                if (scCurrentCourse.aSections[i][j].sKey == $(this).data("key")) {
                    // This is the section that was just toggled
                    scCurrentCourse.aSections[i][j].bSelected = !scCurrentCourse.aSections[i][j].bSelected;
                }
            }
        }
    }

    /**
     * Determines the unique meeting slots for a section.
     *
     * @param sSection A Section object
     * @return         An array consisting of arrays of meeting data with the following order: term, start time, end time, days
     */
    function getMeetingSlotsFromSection(sSection) {
        var aMeetingSlots = [];
        for (var k = 0; k < sSection.aMeetings.length; k++) {
            var mMeeting = sSection.aMeetings[k];

            // Parse the start and end times into a time string
            var iStartHour = Math.floor(mMeeting.nStartTime);
            var iStartMinute = (mMeeting.nStartTime - iStartHour) * 60;
            var iEndHour = Math.floor(mMeeting.nEndTime);
            var iEndMinute = (mMeeting.nEndTime - iEndHour) * 60;
            var sStartTime = (iStartHour < 10 ? "0" : "") + iStartHour + ":" + (iStartMinute < 10 ? "0" : "") + iStartMinute;
            var sEndTime = (iEndHour < 10 ? "0" : "") + iEndHour + ":" + (iEndMinute < 10 ? "0" : "") + iEndMinute;

            // Find a meeting slot to put this in
            var bFoundSlot = false;
            for (var l = 0; l < aMeetingSlots.length; l++) {
                if (aMeetingSlots[l][1] == sStartTime && aMeetingSlots[l][2] == sEndTime) {
                    // This meeting is at the same time - append its day to the day string
                    if (aMeetingSlots[l][3].indexOf(mMeeting.sDay) == -1) aMeetingSlots[l][3] += mMeeting.sDay + " ";

                    // Update the term descriptor if the section spans both terms
                    if (aMeetingSlots[l][0] == "1" && mMeeting.sTerm == "2") aMeetingSlots[l][0] = "1-2";
                    else if (aMeetingSlots[l][0] == "2" && mMeeting.sTerm == "1") aMeetingSlots[l][0] = "1-2";

                    bFoundSlot = true;
                }
            }

            if (!bFoundSlot) {
                // Create a new meeting slot for this meeting
                var aMeetingSlot = [mMeeting.sTerm, sStartTime, sEndTime, mMeeting.sDay + " "];
                aMeetingSlots.push(aMeetingSlot);
            }
        }
        return aMeetingSlots;
    }
    
    /**
     * Starts Scheduler.js's generation module using the current set of courses currently in the table.
     */
    function findSchedules() {
		if(bSchedulesGenerated && !bCoursesModified) {
			// We've already generated schedules and we haven't changed the course list yet
			window.location.href = "schedules.html";
			return;
		}
		
        // Create an array of only course IDs to pass to the generator.
        var aCourseIDs = [];
        for(var i = 0; i < aCourses.length; i++) aCourseIDs.push(aCourses[i].sCourseID);
        
		updateFindSchedulesStatus(0, 0);
        Generator.startGenerating(aCourseIDs, updateFindSchedulesStatus);
        
        $(".ui-footer-start-generation").css("visibility", "hidden");
    }
    
    /**
     * Updates the progress bar at the bottom of the screen with the given progress percentage.
     *
     * @param nProgress     The completion percentage (0 <= nProgress <= 1)
     * @param iNewSchedules The number of schedules found so far
     */
    function updateFindSchedulesStatus(nProgress, iNewSchedules) {
        var sProgress = Math.floor(nProgress * 1000) / 10; // Floor to a tenth of a percent
        $(".ui-footer-progress-bar span").css("width", (nProgress * 100) + "%");
        $(".ui-footer-progress-bar-status").text(sProgress + "%");
        
		if(iNewSchedules >= 0) iSchedulesGenerated = iNewSchedules;
        
        if(nProgress == 1 && iNewSchedules >= 0) {
            // We're done.
            saveGenerationState(true, false, iSchedulesGenerated);
        }
    }
    
    /**
     * Shows a message in the "Generation Bar" at the bottom of the screen.
     *
     * @param sText      The message to be displayed
     * @param bHighlight True if the text should be green, false if grey
     */
    function displayFooterMessage(sText, bHighlight) {
        $(".ui-footer-start-generation").text(sText);
        $(".ui-footer-start-generation").css("visibility", "visible");
        
        if(bHighlight) $(".ui-footer-start-generation").addClass("ui-footer-finished-generation");
        else $(".ui-footer-start-generation").removeClass("ui-footer-finished-generation");
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