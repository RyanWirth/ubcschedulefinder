var Generator = (function () {
    var aCourseIDs = []; // An array containing all of the course IDs to be scheduled
    var aPossibleSchedules = []; // An array containing arrays of possible schedules
    var aCurrentSchedule = []; // An array containing the current schedule being built (arrays within are by course)
    var aCurrentIndices = [];

    var bKillThread = false;
   // var stSortType = SortType.SHORTEST_DAY;
    
    // An enumeration for the currently selected sort type
    var SortType = {
        SHORTEST_DAY: 1,
        LATEST_START_TIME: 2,
        EARLIEST_END_TIME: 3,
    };
    
    /**
     * A datatype for the possible schedules array. Contains the courses and some pre-calculated
     * metadata for sorting the schedules.
     */
    function PossibleSchedule(aCourses, nAverageStartTime, nAverageEndTime) {
        this.aCourses = aCourses;
        this.nAverageStartTime = nAverageStartTime;
        this.nAverageEndTime = nAverageEndTime;
    }

    /**
     * Begins generating schedules given an array of course IDs.
     *
     * @param _aCourseIDs An array of course IDs to generate schedules from
     */
    function startGenerating(_aCourseIDs) {
        aCourseIDs = _aCourseIDs;
        
        // Empty the current indices and schedule array
        aCurrentIndices = [];
        aCurrentSchedule = [];

        // Find the total number of schedules
        for (var i = 0; i < aCourseIDs.length; i++) {
            //iTotalSchedules *= UBCCalendarAPI.getCourseSections(aCourseIDs[i]).length;
            aCurrentIndices.push(0); // Initialize this index to 0
            aCurrentSchedule.push([]);
        }
        
        console.log("[Generator] Using courses: " + aCourseIDs);

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
                    if(aCurrentSchedule[i][j] == null) continue;
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
        
        console.log("[Generator] Scheduling " + iCourseID + "-" + iSectionID + ": " + aCourseIDs[iCourseID]);;

        if (iSectionID >= scSectionContainer.aSections.length) {
            // We're out of section types for this course, so we'll go to the next one
            scheduleCourse(iCourseID + 1);
            return;
        }

        // We still have sections types left to schedule
        var bSectionSelected = false;
        var aSections = scSectionContainer.aSections[iSectionID];
        for (var i = 0; i < aSections.length; i++) {
            var sSection = aSections[i];
            
            console.log("[Generator] Iterating over " + sSection.sKey);

            // Check for selection and conflicts
            if (sSection.bSelected == false) continue;
            
            // This section is selected, so set the flag to not skip this section
            bSectionSelected = true;
            
            if (doesSectionConflictWithCurrentSchedule(sSection, iCourseID, iSectionID)) continue;

            // No conflict, add it and let's check the next one
            if (aCurrentSchedule[iCourseID].length <= iSectionID) aCurrentSchedule[iCourseID].push(sSection);
            else aCurrentSchedule[iCourseID][iSectionID] = sSection;

            // Recurse, adding the next set of section types for the current course ID
            scheduleCourseSections(iCourseID, iSectionID + 1);
        }
        
        if(!bSectionSelected)
        {
            // There are no sections to go in the current iSectionID slot, so we'll put a null element there instead
            if(aCurrentSchedule[iCourseID].length <= iSectionID) aCurrentSchedule[iCourseID].push(null);
            else aCurrentSchedule[iCourseID][iSectionID] = null;
            
            // No sections of this type were selected, so let's skip it
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
        if(sSection1 == null || sSection2 == null) return false;
        
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