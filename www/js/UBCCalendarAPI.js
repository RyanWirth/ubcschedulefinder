var UBCCalendarAPI = (function ($, dDate) {
    var sBaseURL = "https://www.ryanwirth.ca/misc/ubcschedulefinder/proxy.php?";
    var nSessionYear = 2016; //dDate.getFullYear();
    var sSessionCode = "W";

    // Caching
    var bDepartments = false; // False if getDepartments hasn't been called, true otherwise
    var aDepartments = [];

    var oCourses = {}; // A key-value pair object containing courses. Keyed by four-letter department key
    // For example: oCourses = {"CPSC":{aData:[]}}
    // The existence of a child object means that department has been polled already

    var oSections = {}; // A key-value pair object containing SectionContainers. Keyed by deptKey-courseKey
    // The existence of a child object means that course has been polled already

    loadCache();

    /* CLASSES */
    function Department(sKey, sTitle, sFacultyCode, sFaculty) {
        // For example, "CPSC" "Computer Science" "SCIE" "Faculty of Science" 
        this.sKey = sKey;
        this.sTitle = sTitle;
        this.sFacultyCode = sFacultyCode;
        this.sFaculty = sFaculty;
    }

    function Course(sKey, sTitle, sDescription) {
        // For example, "100" "Computational Thinking" "Meaning and impact of computational thinking. Solving problems..."
        this.sKey = sKey;
        this.sTitle = sTitle;
        this.sDescription = sDescription;
    }

    /**
     * Used for sorting by section types. The object aSections is keyed by activity, where each value is an array
     * containing Sections of that activity type.
     */
    function SectionContainer(sCourseID) {
        this.sCourseID = sCourseID;
        this.sTitle = "";
        this.iPossibilities = 0;
        this.aSections = []; // This is an array of arrays - sorted by activity type.
    }

    function Section(sCourseID, sKey, sActivity, nCredits, sStatus, sTerm, sStartWeek, sEndWeek, aMeetings, aInstructors, bSelected) {
        // For example, "MATH-200" "001" "Lecture" 6 "Full" "1-2" "Sep 06, 2016" "Apr 06, 2017" [MeetingObj, MeetingObj, MeetingObj] [InstructorObj] true
        this.sCourseID = sCourseID;
        this.sKey = sKey;
        this.sActivity = sActivity;
        this.nCredits = nCredits;
        this.sStatus = sStatus;
        this.sTerm = sTerm;
        this.sStartWeek = sStartWeek;
        this.sEndWeek = sEndWeek;
        this.aMeetings = aMeetings;
        this.aInstructors = aInstructors;
        this.bSelected = bSelected;
    }

    function Meeting(sTerm, sDay, nStartTime, nEndTime, sBuildingCode, sBuilding, sRoomNumber) {
        // For example, "1" "Mon" 16 18 "SWNG" "West Mall Swing Space" "222"
        // For a meeting on Mondays in term 1 from 16:00 to 18:00 at SWNG 222
        this.sTerm = sTerm;
        this.sDay = sDay;
        this.nStartTime = nStartTime;
        this.nEndTime = nEndTime;
        this.sBuildingCode = sBuildingCode;
        this.sBuilding = sBuilding;
        this.sRoomNumber = sRoomNumber;
    }

    function Instructor(sName, nUBCID) {
        this.sName = sName;
        this.nUBCID = nUBCID;
    }


    /* GETTER FUNCTIONS */
    /**
     * Calls fCallback with an array of all the departments at UBC.
     *
     * @param fCallback A callback function taking one argument: an array of Departments
     */
    function getDepartments(fCallback) {
        // Cache the department list in memory
        if (aDepartments.length > 0) {
            fCallback(aDepartments);
            return;
        } else if (bDepartments) return true;

        bDepartments = true;

        // There is no department list yet, let's get it.
        loadXML(getDepartments_loaded, fCallback, "", "", false);
    }

    /**
     * Intermediate callback for getDepartments. Parses the given json into an array
     * of Department objects, then calls fCallback and passes that array to it.
     *
     * @param fCallback A callback function taking one argument: an array of Departments
     * @param json      A json object containing the response from the server
     */
    function getDepartments_loaded(fCallback, json) {
        // We now have the JSON and the final callback function
        var aDepts = json.dept;
        for (var i in aDepts) {
            if (i == "@attributes") break; // There are no results

            var sKey = aDepts[i]["@attributes"].key;
            var sTitle = aDepts[i]["@attributes"].title;
            var sFacultyCode = aDepts[i]["@attributes"].faccode;
            var sFaculty = aDepts[i]["@attributes"].faculty;
            var dDept = new Department(sKey, sTitle, sFacultyCode, sFaculty);

            aDepartments.push(dDept);
        }

        // Finally, call the original callback, passing the array back to them.
        fCallback(aDepartments);
        saveCache();
    }

    /**
     * Calls fCallback with an array of all the courses in the given department at UBC.
     *
     * @param fCallback     A callback function taking two arguments: an array of Courses and the given sDepartmentKey
     * @param sDepartmentKey The four letter department key (eg. "CPSC", "CHEM", "MATH")
     */
    function getCourses(fCallback, sDepartmentKey) {
        if (oCourses.hasOwnProperty(sDepartmentKey)) {
            if (oCourses[sDepartmentKey].hasOwnProperty("aData")) {
                // This department has already been polled
                fCallback(oCourses[sDepartmentKey].aData, sDepartmentKey);
                return;
            } else return; // This department has been polled, but the original callback hasn't finished
        }

        // Create an object to store the data array and signal that this department has been polled 
        oCourses[sDepartmentKey] = {};

        loadXML(getCourses_loaded, fCallback, sDepartmentKey, "", false, sDepartmentKey);
    }

    /**
     * Intermediate callback for getCourses. Parses the given json into an
     * array of Course objects. Stores them in the oCourses cache object.
     *
     * @param fCallback      A callback function taking two arguments: an array of Courses and the given sDepartmentKey
     * @param sDepartmentKey The four letter department key (eg. "CPSC", "CHEM", "MATH")
     * @param json           A json object containing the response from the server
     */
    function getCourses_loaded(fCallback, sDepartmentKey, json) {
        oCourses[sDepartmentKey].aData = [];

        var aCourses = json.course;
        for (var i in aCourses) {
            if (i == "@attributes") break; // There are no results

            var sKey = aCourses[i]["@attributes"].key;
            var sTitle = aCourses[i]["@attributes"].title;
            var sDescription = aCourses[i]["@attributes"].descr;
            var cCourse = new Course(sKey, sTitle, sDescription);

            oCourses[sDepartmentKey].aData.push(cCourse);
        }

        // Finally, call the original callback, passing the data array back.
        fCallback(oCourses[sDepartmentKey].aData, sDepartmentKey);
        saveCache();
    }

    /**
     * Calls fCallback with a SectionContainer containing all of the sections of the requested course.
     *
     * @param fCallback A callback function taking two arguments: an array of Courses and the sCourseID
     * @param sCourseID The course ID to get the sections for (eg. "CPSC-210", "MATH-100")
     */
    function getSections(fCallback, sCourseID) {
        if (oSections.hasOwnProperty(sCourseID)) {
            if (oSections[sCourseID].aSections.length != 0) {
                // This course has been polled already, return the cached data
                fCallback(oSections[sCourseID], sCourseID);
                return;
            } else return; // This course has been polled, but the original callback has not yet returned
        }

        // Initialize the section object to show that this course has been polled already.
        oSections[sCourseID] = new SectionContainer(sCourseID);

        var aCourseData = sCourseID.split("-");

        // Find the course object for this course and copy its title over, if it exists (which it should)
        if (oCourses.hasOwnProperty(aCourseData[0])) {
            if (oCourses[aCourseData[0]].hasOwnProperty("aData")) {
                for (var i = 0; i < oCourses[aCourseData[0]].aData.length; i++) {
                    if (oCourses[aCourseData[0]].aData[i].sKey == aCourseData[1]) oSections[sCourseID].sTitle = oCourses[aCourseData[0]].aData[i].sTitle;
                }
            }
        }

        loadXML(getSections_loaded, fCallback, aCourseData[0], aCourseData[1], true, sCourseID);
    }

    /**
     * Intermediate callback for getSections. Parses the given json into an
     * array of Section objects. Stores them in the oSections cache object.
     *
     * @param fCallback   A callback function taking one argument: an array of Sections
     * @param sCourseID   The course ID to use for caching (eg. "CPSC-210")
     * @param json        A json object containing the response from the server
     */
    function getSections_loaded(fCallback, sCourseID, json) {
        // Sometimes there will be only one section. If it's an array, iterate through it. Otherwise, add the one section.
        var aSections = json.section;
        if (Array.isArray(aSections))
            for (var i in aSections) getSections_parseSection(aSections[i], sCourseID);
        else if (getSections_parseSection(aSections, sCourseID));

        fCallback(oSections[sCourseID], sCourseID);
        saveCache();
    }

    /**
     * Parses the given oSection json object into a Section object and adds it to the cache.
     *
     * @param oSection  A json object containing the section data to parse
     * @param sCourseID The course ID of this section
     */
    function getSections_parseSection(oSection, sCourseID) {
        if (oSection == undefined || oSection == null) return;

        var sCourseID = sCourseID;
        var sKey = oSection["@attributes"].key;
        var sActivity = oSection["@attributes"].activity;
        var nCredits = parseInt(oSection["@attributes"].credits);
        var sStatus = oSection["@attributes"].status;
        var sTerm = oSection["teachingunits"]["teachingunit"]["@attributes"].termcd;
        var sStartWeek = oSection["teachingunits"]["teachingunit"]["@attributes"].startwk;
        var sEndWeek = oSection["teachingunits"]["teachingunit"]["@attributes"].endwk;
        var bSelected = true;

        // Don't include waiting lists
        if (sActivity == "Waiting List") return;

        // Check for blocked or full sections - default is deselected
        if (sStatus == "Blocked" ||
            sStatus == "STT" ||
            sStatus == "Full" ||
            sStatus == "Restricted")
            bSelected = false;

        // Assemble instructor data. When there are multiple instructors,
        // aInstructorsData is an array. Otherwise it's just an object.
        var aInstructorsData = oSection.hasOwnProperty("instructors") ? oSection["instructors"].instructor : "";
        var aInstructors = [];
        if (Array.isArray(aInstructorsData))
            for (var j in aInstructorsData) aInstructors.push(getSections_parseInstructor(aInstructorsData[j]));
        else if (aInstructorsData != "") aInstructors.push(getSections_parseInstructor(aInstructorsData));

        // Assemble meeting data.
        var aMeetingsData = oSection["teachingunits"]["teachingunit"].hasOwnProperty("meetings") ? oSection["teachingunits"]["teachingunit"]["meetings"].meeting : [];
        var aMeetings = [];
        if (Array.isArray(aMeetingsData))
            for (var j in aMeetingsData) aMeetings.push(getSections_parseMeeting(aMeetingsData[j]));
        else aMeetings.push(getSections_parseMeeting(aMeetingsData));

        // If there are no valid meetings, don't bother adding this section
        if (areMeetingsValid(aMeetings) == false) return;

        var sSection = new Section(sCourseID, sKey, sActivity, nCredits, sStatus, sTerm, sStartWeek, sEndWeek, aMeetings, aInstructors, bSelected);

        // Add the section to the SectionContainer, sorted by activity.
        for (var j = 0; j < oSections[sCourseID].aSections.length; j++) {
            if (oSections[sCourseID].aSections[j][0].sActivity == sActivity) {
                oSections[sCourseID].aSections[j].push(sSection);
                return;
            }
        }
        // We couldn't find an already created array, so we'll make the first entry here
        oSections[sCourseID].aSections.push([sSection]);
    }

    /**
     * Determines if the given array of Meetings is valid (that is, it contains all the required information)
     *
     * @param aMeetings The array of Meetings to validate
     * @return          True if the Meetings are valid, false otherwise
     */
    function areMeetingsValid(aMeetings) {
        if(aMeetings.length == 0) return false;
        
        for (var i = 0; i < aMeetings.length; i++) {
            if (!isMeetingValid(aMeetings[i])) return false;
        }

        return true;
    }

    /**
     * Determines if the given Meeting is valid (that is, it contains all the required information)
     *
     * @param mMeeting The Meeting to validate
     * @return         True if the Meeting is valid, false otherwise
     */
    function isMeetingValid(mMeeting) {
        if(mMeeting.nStartTime == null || mMeeting.nEndTime == null) return false;
        else if (mMeeting.nStartTime < 8 || mMeeting.nEndTime < 9 || mMeeting.nStartTime > 22 || mMeeting.nEndTime > 23) return false;
        else if (mMeeting.sDay == "" || mMeeting.sDay == " ") return false;
        else return true;
    }

    /**
     * Generates an Instructor object from the given oInstructor json object.
     *
     * @param oInstructor A json object representing an instructor
     * @return            An Instructor object.
     */
    function getSections_parseInstructor(oInstructor) {
        return new Instructor(oInstructor["@attributes"].name, parseInt(oInstructor["@attributes"].ubcid));
    }

    /**
     * Generates a Meeting object from the given oMeeting json object.
     *
     * @param oMeeting A json object representing a meeting
     * @return         A Meeting object
     */
    function getSections_parseMeeting(oMeeting) {
        var sTerm = oMeeting["@attributes"].term;
        var sDay = oMeeting["@attributes"].day;
        var sStartTime = oMeeting["@attributes"].starttime;
        var sEndTime = oMeeting["@attributes"].endtime;
        var sBuildingCode = oMeeting["@attributes"].buildingcd;
        var sBuilding = oMeeting["@attributes"].building;
        var sRoomNumber = oMeeting["@attributes"].roomno;

        // Convert sStartTime and sEndTime into numbers
        var aStartTime = sStartTime.split(":");
        var nStartTime = parseInt(aStartTime[0]) + parseInt(aStartTime[1]) / 60;
        var aEndTime = sEndTime.split(":");
        var nEndTime = parseInt(aEndTime[0]) + parseInt(aEndTime[1]) / 60;

        return new Meeting(sTerm, sDay, nStartTime, nEndTime, sBuildingCode, sBuilding, sRoomNumber);
    }

    /**
     * Returns a SectionContainer containing all of the sections for the given course ID. Ensure that this course has
     * loaded previously before calling this (synchronous) function.
     *
     * @param sCourseID The course ID for the section data to be retrieved (eg. "CPSC-210", "MATH-100")
     * @return          A SectionContainer
     */
    function getSectionContainer(sCourseID) {
        if (oSections.hasOwnProperty(sCourseID)) return oSections[sCourseID];
        else return null;
    }

    /**
     * Calls fCallback with an array of Departments whose keys starts with the given sText.
     *
     * @param sText     The text to check each key for
     * @param nLimit    The maximum number of departments to return
     * @param fCallback A function taking an array of Departments as a param
     */
    function getDepartmentsStartingWith(sText, nLimit, fCallback) {
        getDepartments(function (aDepartments) {
            var aResults = [];
            for (var i = 0; i < aDepartments.length; i++) {
                if (aDepartments[i].sKey.substring(0, sText.length) == sText) aResults.push(aDepartments[i]);

                if (aResults.length >= nLimit) break;
            }

            fCallback(aResults);
        });
    }

    /**
     * Calls fCallback with the department key, the original search term, and an array
     * of Courses.
     *
     * @param sSearchTerm    The original search term, used for ignoring stale results
     * @param sDepartmentKey The department key of the courses to get
     * @param sCourseKey     The (partial) course key of the courses to get
     * @param nLimit         The maximum number of courses to get
     * @param fCallback      The callback to call with the results
     */
    function getCoursesStartingWith(sSearchTerm, sDepartmentKey, sCourseKey, nLimit, fCallback) {
        getCourses(function (aCourses) {
            var aResults = [];
            for (var i = 0; i < aCourses.length; i++) {
                if (aCourses[i].sKey.substring(0, sCourseKey.length) == sCourseKey) aResults.push(aCourses[i]);

                if (aResults.length >= nLimit) break;
            }

            fCallback(sDepartmentKey, sSearchTerm, aResults);
        }, sDepartmentKey);
    }
    
    /**
     * Deletes the given course from the cache of sections.
     *
     * @param sCourseID The course ID of the sections to be deleted
     */
    function deleteCourseFromCache(sCourseID) {
        if(oSections.hasOwnProperty(sCourseID)) delete oSections[sCourseID];
        saveCache();
    }

    /**
     * Loads the XML data from UBC's SRV servlet. 
     * If bSections is true, gets all the sections for the department-course pair.
     * If bSections is false but sCourse is defined, gets the course description for the department-course pair.
     * If bSections is false but sDepartment is defined, gets all the courses within the department.
     * Otherwise, gets all departments.
     *
     * Returns the given fCallback and the loaded XML data to fCallbackImmediate(fCallback, xml)
     *
     */
    function loadXML(fCallbackImmediate, fCallback, sDepartment = "", sCourse = "", bSections = false, sExtraData = "") {
        var nReq = bSections ? 4 : (sCourse != "" ? 3 : (sDepartment != "" ? 2 : 0));
        var sURL = sBaseURL + "sessyr=" + nSessionYear + "&sesscd=" + sSessionCode + "&req=" + nReq + "&dept=" + sDepartment + "&course=" + sCourse + "&output=3";

        $.ajax({
            type: 'GET',
            url: sURL,
            dataType: "json",
            success: function (json) {
                // Choose a callback format to use based on how many extra params there are
                if (sExtraData == "") fCallbackImmediate(fCallback, json);
                else fCallbackImmediate(fCallback, sExtraData, json);
            },
            error: function (obj, error, error2) {
                alert(error2);
            }
        });
    }

    /**
     * Loads cached objects (if they exist) from localStorage.
     */
    function loadCache() {
        bDepartments = localStorage.getItem("bDepartments") != null ? Boolean(localStorage.getItem("bDepartments")) : bDepartments;
        aDepartments = localStorage.getItem("aDepartments") != null ? JSON.parse(localStorage.getItem("aDepartments")) : aDepartments;

        oCourses = localStorage.getItem("oCourses") != null ? JSON.parse(localStorage.getItem("oCourses")) : oCourses;

        oSections = localStorage.getItem("oSections") != null ? JSON.parse(localStorage.getItem("oSections")) : oSections;
    }

    /**
     * Saves cached objects to localStorage.
     */
    function saveCache() {
        localStorage.setItem("bDepartments", bDepartments);
        localStorage.setItem("aDepartments", JSON.stringify(aDepartments));

        localStorage.setItem("oCourses", JSON.stringify(oCourses));

        localStorage.setItem("oSections", JSON.stringify(oSections));
    }


    return {
        getDepartments: getDepartments,
        getCourses: getCourses,
        getSections: getSections,
        getSectionContainer: getSectionContainer,
        getDepartmentsStartingWith: getDepartmentsStartingWith,
        getCoursesStartingWith: getCoursesStartingWith,
        saveCache:saveCache,
        deleteCourseFromCache:deleteCourseFromCache
    }
})(jQuery, new Date());