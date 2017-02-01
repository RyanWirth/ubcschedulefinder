var Scheduler = (function() {
    var aCourseIDs = [];
    var aWaitingOnCourseData = [];
    
    function addCourses(aCourses)
    {
        for(var i in aCourses)
        {
            // Add the course ID to the waiting list before adding the course - this is so that
            // we will wait until *all* the data is loaded before proceeding.
            aWaitingOnCourseData.push(aCourses[i]);
        }
        
        // Now start loading every course.
        for(var i in aCourses) addCourse(aCourses[i]);
    }
    
    /**
     * Adds the given course to the list of courses to take and starts retrieving its data.
     */
    function addCourse(sCourseID)
    {
        if(aCourseIDs.includes(sCourseID)) return;
        
        console.log("[" + sCourseID + "]: Added.");
        
        // Keep track of what has been added and what is still loading...
        aCourseIDs.push(sCourseID);
        if(!aWaitingOnCourseData.includes(sCourseID))aWaitingOnCourseData.push(sCourseID);
        
        // Start the loading process.
        UBCCalendarAPI.getSections(addCourse_loaded, sCourseID);
    }
    
    function addCourse_loaded(aSections, sCourseID) {
        // Keep track of the loaded course data--remove this one from the pending list
        console.log("[" + sCourseID + "]: Sections loaded (callback). Found " + aSections.length);
        var iWaitingOnCourseData = aWaitingOnCourseData.indexOf(sCourseID);
        if(iWaitingOnCourseData > -1) aWaitingOnCourseData.splice(iWaitingOnCourseData, 1);
        
        // If we're out of courses to load, start the generation process.
        if(aWaitingOnCourseData.length == 0) Generator.startGenerating();
    }
    
    function getCourseIDs() {
        return aCourseIDs;
    }
    
    return{
        addCourse:addCourse,
        addCourses:addCourses,
        getCourseIDs:getCourseIDs
    }
})();


var Generator = (function() {
    var aCourseIDs = [];          // An array containing all of the course IDs to be scheduled
    var aPossibleSchedules = []; // An array containing arrays of possible schedules
    var aCurrentSchedule = [];   // An array containing the current schedule being built (arrays within are by course)
    var aCurrentIndices = [];
    
    var bKillThread = false;
    
    function startGenerating()
    {
        // Copy the section data into this module.
        aCourseIDs = Scheduler.getCourseIDs().slice();
        
        // Find the total number of schedules
        for(var i = 0; i < aCourseIDs.length; i++) 
        {
            //iTotalSchedules *= UBCCalendarAPI.getCourseSections(aCourseIDs[i]).length;
            aCurrentIndices.push(0); // Initialize this index to 0
            aCurrentSchedule.push([]);
        }
        
        startThread();
    }
    
    function startThread()
    {
        bKillThread = false;
        
        console.log("[Generator] Starting thread.");
        
        scheduleCourse(0);
        
        console.log("[Generator] Thread killed. Starting timer...");
        
        //setTimeout(startThread, 1000);
    }
    
    function scheduleCourse(iCourseID)
    {
        if(iCourseID >= aCourseIDs.length)
        {
            // We are out of courses to schedule - great!
            // Make a 1-dimensional array out of the 2-dimensional current schedule array
            var aPossibleSchedule = [];
            var sPossibleSchedule = "";
            for(var i = 0; i < aCurrentSchedule.length; i++)
                for(var j = 0; j < aCurrentSchedule[i].length; j++)
                    {
                        aPossibleSchedule.push(aCurrentSchedule[i][j]);
                        sPossibleSchedule += aCurrentSchedule[i][j].sCourseID + "-" + aCurrentSchedule[i][j].sKey + " ("+aCurrentSchedule[i][j].sActivity+"), ";
                    }
            
            console.log("[Generator] Found schedule: " + sPossibleSchedule);
            
            // Add the copied array to the array of all possible ones, then return and continue.
            aPossibleSchedules.push(aPossibleSchedule);
            return;
        }
        
        scheduleCourseSections(iCourseID, 0);
    }
    
    function scheduleCourseSections(iCourseID, iSectionID)
    {
        var scSectionContainer = UBCCalendarAPI.getSectionContainer(aCourseIDs[iCourseID]);
        
        if(iSectionID >= scSectionContainer.aSections.length)
        {
            // We're out of section types for this course, so we'll go to the next one
            scheduleCourse(iCourseID + 1);
            return;
        }
        
        // We still have sections types left to test
        var aSections = scSectionContainer.aSections[iSectionID];
        for(var i = 0; i < aSections.length; i++)
        {
            var sSection = aSections[i];
            
            if(doesSectionConflictWithCurrentSchedule(sSection, iCourseID, iSectionID)) continue;
            
            // No conflict, add it and let's check the next one
            if(aCurrentSchedule[iCourseID].length <= iSectionID) aCurrentSchedule[iCourseID].push(sSection);
            else aCurrentSchedule[iCourseID][iSectionID] = sSection;
            
            scheduleCourseSections(iCourseID, iSectionID + 1);
        }
    }
    
    /**
     *
     */
    function doesSectionConflictWithCurrentSchedule(sSection, iCourseID, iSectionID)
    {
        if(iCourseID == 0 && iSectionID == 0) return false; // Nothing has been added yet, so the answer is no
        
        for(var i = 0; i < iCourseID; i++)
        {
            for(var j = 0; j < aCurrentSchedule[i].length; j++)
            {
                if(doSectionsConflict(sSection, aCurrentSchedule[i][j])) return true;    
            }
        }
        
        for(var i = 0; i < iSectionID; i++)
        {
            if(doSectionsConflict(sSection, aCurrentSchedule[iCourseID][i])) return true;    
        }
        
        return false;
    }
    
    /**
     * Returns true if the two given sections conflict, false otherwise.
     * This assumes that sSection1 != sSection2.
     *
     * @param sSection1 The first Section object to check
     * @param sSection2 The second Section object to check
     * @return True if the sections conflict, false otherwise.
     */
    function doSectionsConflict(sSection1, sSection2)
    {
        // Iterate over all of sSection1's meetings
        for(var i in sSection1.aMeetings)
        {
            var mMeeting1 = sSection1.aMeetings[i];
            
            // Given one of sSection1's meetings, iterate over all of sSection2's meetings
            for(var j in sSection2.aMeetings)
            {
                var mMeeting2 = sSection2.aMeetings[j];
                
                // If these meetings are not during the same term, skip further checking
                if(!doTermsOverlap(mMeeting1.sTerm, mMeeting2.sTerm)) continue;
                
                // If these meetings are on different days, skip further checking
                if(mMeeting1.sDay != mMeeting2.sDay) continue;
                
                // These meetings are on the same day - check for time collision
                if(doTimesConflict(mMeeting1.nStartTime, mMeeting1.nEndTime, mMeeting2.nStartTime, mMeeting2.nEndTime))
                    return true; // The times conflict, return true.
            }
        }
        
        // No meetings conflict, return false.
        return false;
    }
    
    /**
     * Checks if the two given term strings overlap.
     *
     * For example, "1-2" and "2" overlap
     *              "1-2" and "1" overlap
     *              "1"   and "1" overlap
     *              "2"   and "2" overlap
     *              "1"   and "2" do not overlap
     *
     * @param sTerm1 The first term string
     * @param sTerm2 The second term string
     * @return       True if the two given term strings overlap, false otherwise.
     */
    function doTermsOverlap(sTerm1, sTerm2)
    {
        if(sTerm1 == "1-2" || sTerm2 == "1-2") return true;
        else return sTerm1 == sTerm2;
    }
    
    /**
     * Returns true if the event spanning [nStart1, nEnd1] conflicts with [nStart2, nEnd2]
     *
     * @param nStart1 The starting time of event 1
     * @param nEnd1   The ending time of event 1
     * @param nStart2 The starting time of event 2
     * @param nEnd2   The ending time of event 2
     * @return True if the event times conflict, false otherwise.
     */
    function doTimesConflict(nStart1, nEnd1, nStart2, nEnd2)
    {
        return (nStart1 < nEnd2) && (nEnd1 > nStart2);
    }
    
    return {
        startGenerating:startGenerating,
        doTimesConflict:doTimesConflict
    }
    
})();

//Scheduler.addCourses(["CPSC-210", "MATH-200"]);

$(function() {
    // Load the departments
    UBCCalendarAPI.getDepartments(function(){});
    
    $("#course-list tbody tr").click(showCourseModalWindow);
    $("#course .ui-modal-window-header-close").click(hideCourseModalWindow);
    
    $(".ui-content-text-header-search").bind("input", searchInputChanged);
    $(".ui-content-text-header-search").focusin(searchInputChanged);
    
    $(".search-results").on("click", ".search-result", selectCourse);
});

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
    
    if(sSearchTerm.length >= 4)
    {
        // Interpret the current value as a department key
        var sDepartmentKey = sSearchTerm.substring(0, 4).toUpperCase();
        var sCourseKey = sSearchTerm.substring(4).trim();
        
        UBCCalendarAPI.getCoursesStartingWith(sSearchTerm, sDepartmentKey, sCourseKey, 6, addSearchResultsCourses);
    } else
    if(sSearchTerm.length >= 1) UBCCalendarAPI.getDepartmentsStartingWith(sSearchTerm.toUpperCase(), 6, addSearchResultsDepartments);
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
    for(var i = 0; i < aDepartments.length; i++) addSearchResult(aDepartments[i].sKey, aDepartments[i].sTitle);
    if(aDepartments.length == 0) addSearchResult("No departments found", "Please try another.");
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
    if($(".ui-content-text-header-search").val().trim() != sSearchTerm) return;
    
    clearSearchResults();
    for(var i = 0; i < aCourses.length; i++) addSearchResult(sDepartmentKey + " " + aCourses[i].sKey, aCourses[i].sTitle);
    if(aCourses.length == 0) addSearchResult("No courses found", "Please try another.");
}

function clearSearchResults() {
    $(".search-results").empty();
}

function addSearchResult(sTitle, sDescription)
{
    $(".search-results").append('<li class="search-result" data-key="'+sTitle+'">'+sTitle+"<br/><span>"+sDescription+"</span></</li>");
}

function selectCourse() {
    var sKey = $(this).data("key");
    var aStringData = sKey.split(" ");
    
    if(aStringData.length != 2) return;
    else requestCourse(aStringData[0], aStringData[1]);
}

function requestCourse(sDepartmentKey, sCourseKey) {
    UBCCalendarAPI.getSections(addCourseToList, sDepartmentKey + "-" + sCourseKey);
}

var iCourses = 0;
var aCoursePossibilities = [];
function addCourseToList(scSectionContainer)
{
    var aStringData = scSectionContainer.sCourseID.split("-");
    var sDepartmentKey = aStringData[0];
    var sCourseKey = aStringData[1];
    var bHasTerm1 = false;
    var bHasTerm2 = false;
    var sSectionTypes = "";
    var iPossibilitiesTerm1 = 1;
    var iPossibilitiesTerm2 = 1;
    
    for(var i = 0; i < scSectionContainer.aSections.length; i++)
    {
        var sActivity = scSectionContainer.aSections[i][0].sActivity;
        var iTerm1 = 0;
        var iTerm2 = 0;
        
        for(var j = 0; j < scSectionContainer.aSections[i].length; j++)
        {
            var sTerm = scSectionContainer.aSections[i][j].sTerm;
            if(sTerm == "1") iTerm1++;
            else if(sTerm == "2") iTerm2++;
        }
        
        iPossibilitiesTerm1 *= iTerm1;
        iPossibilitiesTerm2 *= iTerm2;
        bHasTerm1 = bHasTerm1 || (iTerm1 > 0);
        bHasTerm2 = bHasTerm2 || (iTerm2 > 0);
        sSectionTypes += sActivity + " (" + iTerm1 + "/" + iTerm2 + "), ";
    }
    
    var sTerms = (bHasTerm1 && bHasTerm2) ? "1/2" : (bHasTerm1 ? "1" : "2");
    var iPossibilities = (bHasTerm1 ? iPossibilitiesTerm1 : 0) + (bHasTerm2 ? iPossibilitiesTerm2 : 0);
    sSectionTypes = sSectionTypes.substr(0,sSectionTypes.length - 2); // Remove trailing ", "
    
    $("#course-list tbody").append('<tr'+(++iCourses % 2 == 1 ? ' class="odd"' : '')+'>\
                            <td id="course-name">'+sDepartmentKey + " " + sCourseKey+'</td>\
                            <td>'+scSectionContainer.sTitle+'</td>\
                            <td>'+sTerms+'</td>\
                            <td>'+sSectionTypes+'</td>\
                            <td>'+iPossibilities+'</td>\
                        </tr>');
    
    // Update the total possibilities counter in the footer
    aCoursePossibilities.push(iPossibilities);
    var iTotalPossibilities = 1;
    for(var i = 0; i < aCoursePossibilities.length; i++) iTotalPossibilities *= aCoursePossibilities[i];
    $("#course-list tfoot tr").attr("class", (iCourses % 2 == 0 ? "odd" : ""));
    $("#course-list tfoot tr td#total").text(iTotalPossibilities);
}

function showCourseModalWindow() {
    $("#course").css("visibility", "visible");
    $("#course").animate({opacity:1}, 150);
    
    var courseName = $(this).find("#course-name").text();
    
    $("#course .ui-modal-window-header-title").text(courseName);
}

function hideCourseModalWindow() {
    $("#course").css("visibility", "hidden");
    $("#course").css("opacity", "0");
}