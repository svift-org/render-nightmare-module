/*
 *
 * Add header info here
 *
 */

'use strict';

var fs = require('fs')

var Nightmare = require('nightmare')
var nightmare = Nightmare()

var render = (function () {
 
  var module = {},
    job = null,
    //needs to be acquired from config
    default_job = {
      snap_count : 0,
      data: {params:{width:500,height:500}},
      url: 'https://'+process.env.HEROKU_URL+'.herokuapp.com/'+process.env.EXPRESS_SECRET+'/vis',
      id: null,
      folder: null
    },
    render_callback = null,
    update_callback = null

  //Load template and scripts+styles
  module.init = async function (callback, _update_callback) {
    render_callback = callback
    update_callback = _update_callback
    try {
      const load = nightmare
        .goto(default_job.url)
        .viewport(default_job.data.params.width, default_job.data.params.height)

      nightmare.evaluate(function(){
        //wait for page to finish loading
        return false
      }).then(function(){
        render_callback('initDone')
      }).catch(reason => {
        console.error(reason)
      })

    } catch (error) {
      //TODO: Try again?
      throw error;
    }
  }

  module.resize = async function (width, height, callback){
    try{
      const load = nightmare
        .viewport(width, height)

      await nightmare.evaluate(function(){
        //wait for page to finish loading
        return false
      })

      callback()

    } catch (error) {
      throw error;
    }    
  }

  module.render = async function(data, id, folder){
    job = {}
    for(var key in default_job){
      job[key] = default_job[key]
    }
    job.id = id
    job.data = data
    job.folder = folder
    if(!('duration' in job.data.params)){ job.data.params['duration'] = 100 }
    if(!('width' in job.data.params)){ job.data.params['width'] = 500 }
    if(!('height' in job.data.params)){ job.data.params['height'] = 500 }

    try {
      const load = nightmare
        .evaluate(function (data) {
          vis(data, function(){});
        }, data)

      await nightmare.then(function (result) {
        module.resize(job.data.params.width, job.data.params.height, module.snap)

      }).catch(function (error) {
        console.error('Failed:', error);

      })

    } catch (error) {
      //TODO: Try again?
      throw error;
    }
  }

  module.snap = async function (){
    job.snap_count++;

    try {
      const load = nightmare
        .screenshot('.' + job.folder + '/png/' + module.formatNumber(job.snap_count) + '.png', {x:0,y:0,width:job.data.params.width,height:job.data.params.height})

      await nightmare.then(function (result) {
        update_callback('png', (job.snap_count / job.data.params.duration))
        module.getSVG()
      }).catch(function (error) {
        console.error('Failed:', error);

      })

    } catch (error) {
      throw error;
    }
  }

  //The SVG output is optimized for Browser, Adobe Illustrator and Sketch App

  module.cleanSVG = function (svg){
    var replace = [
      ['sans-serif', 'Verdana'],
      ['width="100%"', 'width="'+job.data.params.width+'"'],
      ['height="100%"', 'height="'+job.data.params.height+'"'],
      ['<svg', '<svg xmlns="http://www.w3.org/2000/svg"']
    ]

    replace.forEach(function(r){
      svg = svg.split(r[0]).join(r[1])
    })
    
    return svg
  }

  module.getSVG = async function (){
    try {
      const load = nightmare
        .evaluate(function () {
          return getSVG()
        })

      await nightmare.then(function (result) {
        fs.writeFileSync('.' + job.folder + '/svg/' + module.formatNumber(job.snap_count) + '.svg', module.cleanSVG(result), 'utf8')

        if(job.snap_count < job.data.params.duration){
          update_callback('svg', (job.snap_count / job.data.params.duration))
          module.goTo()
        }else{
          render_callback('renderDone');
        }

      }).catch(function (error) {
        console.error('Failed:', error);
      })

    } catch (error) {
      throw error;
    }
  }

  module.goTo = async function (){
    try {
      const load = nightmare
        .evaluate(function (position) {
          init(position, function(position){return position;});
        }, (job.snap_count / job.data.params.duration))

      await nightmare.then(function (result) {
        module.snap();
      })
      .catch(function (error) {
        console.error('Failed:', error);
      })

    } catch (error) {
      throw error;
    }
  }

  module.formatNumber = function (n) {
    if(n>99){
      return n
    }else if(n>9){
      return '0'+n
    }else{
      return '00'+n
    }
  }

  return module;
 
})();

module.exports = render;