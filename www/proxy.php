<?php
header('Access-Control-Allow-Origin: *');  
header("Content-type: text/json");

$baseURL = "https://courses.students.ubc.ca/cs/servlets/SRVCourseSchedule?" . http_build_query($_GET);

$contents = file_get_contents($baseURL);
$encoded = utf8_encode($contents);

$xml = simplexml_load_string($encoded);
$json = json_encode($xml);

echo $json;

?>