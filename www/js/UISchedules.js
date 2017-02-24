var UI = (function($) {
    
    $(function() {
       
        // Load in the first schedules
        
        realignScheduleItems();
        
    });
    
    function realignScheduleItems() {
        $("div.ui-schedule-events li").each(function() {
            var aStartTime = $(this).data("start").split(":");
            var aEndTime = $(this).data("end").split(":");
        
            var nStartTime = parseInt(aStartTime[0]) + parseInt(aStartTime[1]) / 60;
            var nEndTime = parseInt(aEndTime[0]) + parseInt(aEndTime[1]) / 60;
            
            var nDuration = nEndTime - nStartTime;
            var nHeight = nDuration * 50 - 4;
            
            var nYPos = (nStartTime - 8) * 50 + 50;
            
            $(this).css("top", nYPos + "px");
            $(this).css("height", nHeight + "px");
        })
    }
    
})(jQuery);