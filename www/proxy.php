<?php
header('Access-Control-Allow-Origin: *');  
header("Content-type: text/json");

$baseURL = "https://courses.students.ubc.ca/cs/servlets/SRVCourseSchedule?" . http_build_query($_GET);

$xml = simplexml_load_file(rawurlencode($baseURL));
$json = json_encode($xml);

echo $json;

?>