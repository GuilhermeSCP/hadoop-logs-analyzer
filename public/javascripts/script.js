$('form').submit(function(event){
  event.preventDefault();
  ParseFile();
});
function ParseFile()
{
  var file, tasks=[], objects=[], workers=[];
  var files = document.getElementById('files').files;
  if (!files.length) {
    alert('Please select a file!');
    return;
  }

  function Task (id) {
    this.taskId = id;
    this.type = "";
    this.startTime = "";
    this.finishTime  = "";
    this.worker = "";
  }

  Task.prototype.getStartTime = function() {
    return this.startTime;
  }

  Task.prototype.getFinishTime = function() {
    return this.finishTime;
  }

  var reader = new FileReader();

  reader.readAsText(files[0]);

  reader.onloadend = function(){
    var dataURL = reader.result;
    file = reader.result;            

    objects = file.split("\n\n");
    var data = "[";
    for(var j=1;j<objects.length-1;j++){
      data=data+objects[j]+",";
    }
    data=data.slice(0,-1);
    data=data+"]";  
    var json = JSON.parse(data);
    $.each(json, function(idx, obj) {
      if(obj.type === "TASK_STARTED"){
        var task = new Task(obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskStarted"].taskid);
        console.log("taskid: "+ obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskStarted"].taskid);
        console.log("tasktype: "+ obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskStarted"].taskType);
        console.log("starttime: "+ obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskStarted"].startTime);
        task.type = obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskStarted"].taskType;
        task.startTime = obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskStarted"].startTime;


        tasks.push(task);
        console.log("tasks size: "+ tasks.length);
      }
      else if(obj.type === "TASK_FINISHED"){

        var id = obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskFinished"].taskid;
        //check tasks array position for taskid
        var index;
        for(var i=0;i<=tasks.length-1;i++){
          if(tasks[i].taskId == id) 
            index = i;
        }
        var attmpt= obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskFinished"].successfulAttemptId;
        $.each(json, function(idxx, objx){
          if(tasks[index].type == "MAP" && objx.type == "MAP_ATTEMPT_FINISHED"){
            if(objx.event["org.apache.hadoop.mapreduce.jobhistory.MapAttemptFinished"].attemptId == attmpt){
              tasks[index].worker = objx.event["org.apache.hadoop.mapreduce.jobhistory.MapAttemptFinished"].hostname;
            }
          }
          else if(tasks[index].type == "REDUCE" && objx.type == "REDUCE_ATTEMPT_FINISHED"){
            if(objx.event["org.apache.hadoop.mapreduce.jobhistory.ReduceAttemptFinished"].attemptId == attmpt){
              tasks[index].worker = objx.event["org.apache.hadoop.mapreduce.jobhistory.ReduceAttemptFinished"].hostname;
            }
          }
        });
        tasks[index].finishTime = obj.event["org.apache.hadoop.mapreduce.jobhistory.TaskFinished"].finishTime;


        //$("body").append("<span>ID: "+tasks[index].taskId+";</span><br>"+"<span> Type: "+tasks[index].type+";</span><br>"+"<span> Start: "+tasks[index].startTime+";</span><br>"+"<span> Finish: "+tasks[index].finishTime+";</span><br>" + "<span> Worker: "+tasks[index].worker+";</span><br><br>");
      }
    });
    for(var i=0;i<tasks.lenght-1;i++){
      for(var j=0;j<workers.length-1;j++){
        if(typeof workers[j] == tasks[i].worker)
          workers.push(tasks[i].worker);
      }
    }
    var min=999999999999999999999999999;
    tasks = tasks.reverse();
    var jstring = "[";
    var map_color = '"red"';
    var reduce_color = '"green"';
    for(var i=0;i<tasks.length;i++){
      jstring = jstring + '{"node": "' + tasks[i].worker + '", "y_axis":' + parseInt(50*i+10) + ', "tasks": [ {"task": "' + tasks[i].type + '", "x_axis": ' + tasks[i].startTime +', "width": ' + parseInt(tasks[i].finishTime-tasks[i].startTime) + ', "color": ';
      if(tasks[i].type=="MAP"){
        jstring += map_color;
      }
      else if(tasks[i].type=="REDUCE")
        jstring += reduce_color; 
      jstring += "}]},";

      if(tasks[i].startTime<min)
        min=tasks[i].startTime;
    }
    jstring = jstring.slice(0,-1);
    jstring += "]";

    console.log(jstring);
    draw(JSON.parse(jstring), min);
  };

}

function draw(jsonData, min) {
  var bar_height = 20;
  var max_x = 0;
  var max_y = 0;

  var jsonDataFinal = [];
  for(var i = 0; i < jsonData.length; i++) 
  {
    var temp_x;
    var temp_y = jsonData[i].y_axis + bar_height;

    for(var j = 0; j < jsonData[i].tasks.length; j++)
    {      
      temp_x = jsonData[i].tasks[j].x_axis + jsonData[i].tasks[j].width;
      temp_x = temp_x/100;
      if ( temp_x >= max_x ) { max_x = temp_x; }
      var rect = 
          {
            "node": jsonData[i].worker,
            "task": jsonData[i].tasks[j].task,
            "x_axis": parseFloat(jsonData[i].tasks[j].x_axis-min), 
            "y_axis": jsonData[i].y_axis,
            "width": parseFloat(jsonData[i].tasks[j].width/100), 
            "color" : jsonData[i].tasks[j].color
          };
      jsonDataFinal.push(rect);
    }
    if ( temp_y >= max_y ) { max_y = temp_y; }
  }

  var svgContainer = d3.select("#graph").append("svg").attr("width", max_x + 20).attr("height", max_y + 20);

  var rectangleGroup = svgContainer.append("g");  

  var tip = d3.tip().attr('class', 'd3-tip').offset([-20, 0])
  .html(function(d) {
    return "<div class='tooltip'><div> Task: " + d.task + "</div><div> Worker: " + d.node + "</div><div> Start time: " + Date.parse(d.x_axis) + "</div><div> Finish time: " + Date.parse(d.x_axis+d.width) + "</div></div>"
  })

  svgContainer.call(tip);

  var rectangles = rectangleGroup.selectAll("rect").data(jsonDataFinal).enter().append("rect").on('mouseover', function(d) {
    tip.show(d);
    tip.style({'opacity': '0.8'});
  }).on('mouseout', function(d) {
    tip.hide(d);
  });


  var rectangleAttributes = rectangles
  .attr("x", function (d) { return d.x_axis; })
  .attr("y", function (d) { return d.y_axis; })
  .attr("height", 20)
  .attr("width", function (d) { return d.width; })
  .style("fill", function(d) { return d.color; });

  var axisScale = d3.scale.linear().domain([0, 100]).range([0, max_x]);

  //Create the Axis
  var xAxis = d3.svg.axis().scale(axisScale).orient("bottom");

  //Create an SVG group Element for the Axis elements and call the xAxis function
  var xAxisGroup = svgContainer.append("g").attr("transform", "translate(0," + max_y+20 + ")").call(xAxis);
}