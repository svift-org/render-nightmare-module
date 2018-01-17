/*
 *
 * Add header info here
 *
 */

'use strict';

var fs = require('fs'),
  gm = require('gm')

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
    update_callback = null,
    social_callback = null,
    size_count = 0,
    config = null

  //Load template and scripts+styles
  module.init = async function (callback, _update_callback, _social_callback, _config) {
    config = _config
    render_callback = callback
    update_callback = _update_callback
    social_callback = _social_callback
    try {
      const load = nightmare
        .goto(default_job.url)
        .viewport(config.video.size.width, config.video.size.height)

      nightmare.evaluate(function(){
        //wait for page to finish loading
        return false
      }).then(function(){
        render_callback('initDone')
      }).catch(reason => {
        console.error('render-nightmare:init', reason)
      })

    } catch (error) {
      //TODO: Try again?
      throw error;
    }
  }

  module.resize = async function (width, height, callback){
    var _callback = callback

    nightmare
      .viewport(width, height)
      .evaluate(function(){
        //wait for page to finish loading
        return false
      }).then(result => {
        _callback()
      }).catch(reason => {
        console.error('render-nightmare:resize', reason)
      })

  }

  module.setScale = async function (scale, callback){
    try{
      const load = nightmare
        .evaluate(function (data) {
          setScale(data, function(){ return true; });
        }, scale)
        .catch(reason => {
          console.error('render-nightmare:setScale1', reason)
        })

      await nightmare.then(function(result){ 
          callback()
        })
      

    } catch (error) {
      throw error;
    }    
  }

  module.render = async function(data, id, folder){
    size_count = 0
    job = {}
    for(var key in default_job){
      job[key] = default_job[key]
    }
    job.id = id
    job.data = data
    job.folder = folder
    if(!('duration' in job.data.params)){ job.data.params['duration'] = 100 }

    try {
      const load = nightmare
        .evaluate(function (data) {
          vis(data, function(){});
        }, data)
        .catch(reason => {
          console.error('render-nightmare:render1', reason)
        })

      await nightmare.then(function (result) {

        module.goTo(1, module.processSize)

      }).catch(reason => {
        console.error('render-nightmare:render2', reason)
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
        .screenshot('.' + job.folder + '/png/' + module.formatNumber(job.snap_count) + '.png', {x:0,y:0,width:config.video.output.width,height:config.video.output.height})
        .catch(reason => {
          console.error('render-nightmare:snap1', reason)
        })

      await nightmare.then(function (result) {
        update_callback('png', (job.snap_count / job.data.params.duration))
        if(job.snap_count == job.data.params.duration){
          module.getSVG()
        }else{
          module.goTo((job.snap_count / job.data.params.duration), module.snap)
        }
      }).catch(reason => {
        console.error('render-nightmare:snap2', reason)
      })

    } catch (error) {
      throw error;
    }
  }

  //The SVG output is optimized for Browser, Adobe Illustrator and Sketch App

  module.cleanSVG = function (svg, width, height){
    var replace = [
      ['sans-serif', 'Verdana'],
      ['width="100%"', 'width="'+width+'"'],
      ['height="100%"', 'height="'+height+'"'],
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
        }).catch(reason => {
        console.error('render-nightmare:getSVG1', reason)
      })

      await nightmare.then(function (result) {
        fs.writeFileSync('.' + job.folder + '/svg/' + module.formatNumber(job.snap_count) + '.svg', module.cleanSVG(result, config.video.size.width, config.video.size.height), 'utf8')

        if(job.snap_count < job.data.params.duration){
          update_callback('svg', (job.snap_count / job.data.params.duration))
          module.goTo((job.snap_count / job.data.params.duration), module.snap)
        }else{
          render_callback('renderDone');
        }

      }).catch(reason => {
        console.error('render-nightmare:getSVG2', reason)
      })

    } catch (error) {
      throw error;
    }
  }

  module.processSize = async function (){
    if(size_count >= config.sizes.length){
      social_callback()

      //All the sizes are done. Prepare for keyframe rendering
      module.setScale(false, function(){
        module.resize(config.video.size.width, config.video.size.height, function(){
          module.reset(function(){
            module.setScale(true, function(){
              module.resize(config.video.output.width, config.video.output.height, function(){
                module.goTo(0, module.snap)
              })
            })
          })
        })
      })

    }else{
      module.setScale(false, function(){
        module.resize(config.sizes[size_count].size.width, config.sizes[size_count].size.height, function(){
          module.setScale(true, function(){
            module.resize(config.sizes[size_count].scale.width, config.sizes[size_count].scale.height, function(){
              module.goTo(1, function(){
                try {
                  const load = nightmare
                    .screenshot('.' + job.folder + '/social/' + config.sizes[size_count].file + '.png', {x:0,y:0,width:config.sizes[size_count].scale.width,height:config.sizes[size_count].scale.height})
                    .then(function (result) {
                      if(config.sizes[size_count].scale.width != config.sizes[size_count].output.width || config.sizes[size_count].scale.height != config.sizes[size_count].output.height){
                        gm()
                          .in('.' + job.folder + '/social/' + config.sizes[size_count].file + '.png')
                          .gravity('Center')
                          .extent(config.sizes[size_count].output.width, config.sizes[size_count].output.height)
                          .background('#ffffff')
                          .write('.' + job.folder + '/social/' + config.sizes[size_count].file + '.png', function(err){
                            if (err) throw err;
                            
                            size_count++
                            module.processSize()
                          });

                      }else{
                        size_count++
                        module.processSize()
                      }

                    }).catch(reason => {
                      console.error('render-nightmare:processSize', reason)
                    })

                } catch (error) {
                  throw error;
                }
              })
            })
          })
        })
      })
    }
  }

  module.reset = async function (nextFunc){
    try {
      const load = nightmare
        .evaluate(function () {
          console.log('reset');
          reset();
        }).catch(reason => {
          console.error('render-nightmare:reset1', reason)
        })

      await nightmare.then(function (result) {
        nextFunc()
      })
      .catch(reason => {
        console.error('render-nightmare:reset2', reason)
      })

    } catch (error) {
      throw error;
    }
  }

  module.goTo = async function (keyframe, nextFunc){
    try {
      const load = nightmare
        .evaluate(function (position) {
          init(position, function(position){return position;});
        }, keyframe)
        .catch(reason => {
          console.error('render-nightmare:goTo1', reason)
        })

      await nightmare.then(function (result) {
        nextFunc()
      })
      .catch(reason => {
        console.error('render-nightmare:goTo2', reason)
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