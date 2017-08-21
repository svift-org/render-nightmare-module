var render = require('../index.js')

function complete(msg){
  console.log('complete', msg)
  if(msg == 'initDone'){
    render.render(
      {
        "params":{
          "duration":100,
          "title":"Arbeitslosenquite 2009 bis 2017",
          "source":"",
          "custom_image_size":[],
          "theme":"default",
          "styles":{},
          "annotations":[]
        },
        "vis":{
          "type":"barchart"
        },
        "data":{
          "columns":["Jahr","Wert"],
          "types":["date","int"],
          "data":[
            [2017,3.9],
            [2016,4.1],
            [2015,4.6],
            [2014,5.0],
            [2013,5.2],
            [2012,5.5],
            [2011,5.9],
            [2010,7.1],
            [2009,7.8]
          ]
        }
      },
      'render-id',
      './output/test'
    )
  }else if(msg == 'renderDone'){
    process.exit()
  }
}

render.init(complete)