var Scheduler = (function () {
    var aCourseIDs = [];
    var aWaitingOnCourseData = [];

    function addCourses(aCourses) {
        for (var i in aCourses) {
            // Add the course ID to the waiting list before adding the course - this is so that
            // we will wait until *all* the data is loaded before proceeding.
            aWaitingOnCourseData.push(aCourses[i]);
        }

        // Now start loading every course.
        for (var i in aCourses) addCourse(aCourses[i]);
    }

    /**
     * Adds the given course to the list of courses to take and starts retrieving its data.
     */
    function addCourse(sCourseID) {
        if (aCourseIDs.includes(sCourseID)) return;

        console.log("[" + sCourseID + "]: Added.");

        // Keep track of what has been added and what is still loading...
        aCourseIDs.push(sCourseID);
        if (!aWaitingOnCourseData.includes(sCourseID)) aWaitingOnCourseData.push(sCourseID);

        // Start the loading process.
        UBCCalendarAPI.getSections(addCourse_loaded, sCourseID);
    }

    function addCourse_loaded(aSections, sCourseID) {
        // Keep track of the loaded course data--remove this one from the pending list
        console.log("[" + sCourseID + "]: Sections loaded (callback). Found " + aSections.length);
        var iWaitingOnCourseData = aWaitingOnCourseData.indexOf(sCourseID);
        if (iWaitingOnCourseData > -1) aWaitingOnCourseData.splice(iWaitingOnCourseData, 1);

        // If we're out of courses to load, start the generation process.
        if (aWaitingOnCourseData.length == 0) Generator.startGenerating();
    }

    function getCourseIDs() {
        return aCourseIDs;
    }

    return {
        addCourse: addCourse,
        addCourses: addCourses,
        getCourseIDs: getCourseIDs
    }
})();


var Generator = (function () {
    var aCourseIDs = []; // An array containing all of the course IDs to be scheduled
    var aPossibleSchedules = []; // An array containing arrays of possible schedules
    var aCurrentSchedule = []; // An array containing the current schedule being built (arrays within are by course)
    var aCurrentIndices = [];

    var bKillThread = false;

    function startGenerating() {
        // Copy the section data into this module.
        aCourseIDs = Scheduler.getCourseIDs().slice();

        // Find the total number of schedules
        for (var i = 0; i < aCourseIDs.length; i++) {
            //iTotalSchedules *= UBCCalendarAPI.getCourseSections(aCourseIDs[i]).length;
            aCurrentIndices.push(0); // Initialize this index to 0
            aCurrentSchedule.push([]);
        }

        startThread();
    }

    function startThread() {
        bKillThread = false;

        console.log("[Generator] Starting thread.");

        scheduleCourse(0);

        console.log("[Generator] Thread killed. Starting timer...");

        //setTimeout(startThread, 1000);
    }

    function scheduleCourse(iCourseID) {
        if (iCourseID >= aCourseIDs.length) {
            // We are out of courses to schedule - great!
            // Make a 1-dimensional array out of the 2-dimensional current schedule array
            var aPossibleSchedule = [];
            var sPossibleSchedule = "";
            for (var i = 0; i < aCurrentSchedule.length; i++)
                for (var j = 0; j < aCurrentSchedule[i].length; j++) {
                    aPossibleSchedule.push(aCurrentSchedule[i][j]);
                    sPossibleSchedule += aCurrentSchedule[i][j].sCourseID + "-" + aCurrentSchedule[i][j].sKey + " (" + aCurrentSchedule[i][j].sActivity + "), ";
                }

            console.log("[Generator] Found schedule: " + sPossibleSchedule);

            // Add the copied array to the array of all possible ones, then return and continue.
            aPossibleSchedules.push(aPossibleSchedule);
            return;
        }

        scheduleCourseSections(iCourseID, 0);
    }

    function scheduleCourseSections(iCourseID, iSectionID) {
        var scSectionContainer = UBCCalendarAPI.getSectionContainer(aCourseIDs[iCourseID]);

        if (iSectionID >= scSectionContainer.aSections.length) {
            // We're out of section types for this course, so we'll go to the next one
            scheduleCourse(iCourseID + 1);
            return;
        }

        // We still have sections types left to test
        var aSections = scSectionContainer.aSections[iSectionID];
        for (var i = 0; i < aSections.length; i++) {
            var sSection = aSections[i];

            // Check for selection and conflicts
            if (sSection.bSelected == false) continue;
            else if (doesSectionConflictWithCurrentSchedule(sSection, iCourseID, iSectionID)) continue;

            // No conflict, add it and let's check the next one
            if (aCurrentSchedule[iCourseID].length <= iSectionID) aCurrentSchedule[iCourseID].push(sSection);
            else aCurrentSchedule[iCourseID][iSectionID] = sSection;

            // Recurse, adding the next set of section types for the current course ID
            scheduleCourseSections(iCourseID, iSectionID + 1);
        }
    }

    /**
     *
     */
    function doesSectionConflictWithCurrentSchedule(sSection, iCourseID, iSectionID) {
        if (iCourseID == 0 && iSectionID == 0) return false; // Nothing has been added yet, so the answer is no

        for (var i = 0; i < iCourseID; i++) {
            for (var j = 0; j < aCurrentSchedule[i].length; j++) {
                if (doSectionsConflict(sSection, aCurrentSchedule[i][j])) return true;
            }
        }

        for (var i = 0; i < iSectionID; i++) {
            if (doSectionsConflict(sSection, aCurrentSchedule[iCourseID][i])) return true;
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
    function doSectionsConflict(sSection1, sSection2) {
        // Iterate over all of sSection1's meetings
        for (var i in sSection1.aMeetings) {
            var mMeeting1 = sSection1.aMeetings[i];

            // Given one of sSection1's meetings, iterate over all of sSection2's meetings
            for (var j in sSection2.aMeetings) {
                var mMeeting2 = sSection2.aMeetings[j];

                // If these meetings are not during the same term, skip further checking
                if (!doTermsOverlap(mMeeting1.sTerm, mMeeting2.sTerm)) continue;

                // If these meetings are on different days, skip further checking
                if (mMeeting1.sDay != mMeeting2.sDay) continue;

                // These meetings are on the same day - check for time collision
                if (doTimesConflict(mMeeting1.nStartTime, mMeeting1.nEndTime, mMeeting2.nStartTime, mMeeting2.nEndTime))
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
    function doTermsOverlap(sTerm1, sTerm2) {
        if (sTerm1 == "1-2" || sTerm2 == "1-2") return true;
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
    function doTimesConflict(nStart1, nEnd1, nStart2, nEnd2) {
        return (nStart1 < nEnd2) && (nEnd1 > nStart2);
    }

    return {
        startGenerating: startGenerating,
        doTimesConflict: doTimesConflict
    }

})();