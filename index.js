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
    size_count = 0,
    config = null

  //Load template and scripts+styles
  module.init = async function (callback, _update_callback, _config) {
    config = _config
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

  module.setScale = async function (scale, callback){
    try{
      const load = nightmare
        .evaluate(function (data) {
          setScale(data, function(){});
        }, scale)

      await nightmare.evaluate(function(){ return false; })

      callback()

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
    if(!('width' in job.data.params)){ job.data.params['width'] = 500 }
    if(!('height' in job.data.params)){ job.data.params['height'] = 500 }

    try {
      const load = nightmare
        .evaluate(function (data) {
          vis(data, function(){});
        }, data)

      await nightmare.then(function (result) {

        module.goTo(1, module.processSize)

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
          module.goTo((job.snap_count / job.data.params.duration), module.snap)
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

  module.processSize = async function (){
    if(size_count >= config.sizes.length-1){
      //All the sizes are done. Prepare for keyframe rendering
      module.setScale(false, function(){
        module.resize(config.video.size.width, config.video.size.height, function(){
          module.setScale(true, function(){
            module.resize(config.video.output.width, config.video.output.height, function(){
              module.goTo(0, module.snap)
            })
          })
        })
      })

    }else{
      module.setScale(false, function(){
        module.resize(config.sizes[size_count].size.width, config.sizes[size_count].size.height, function(){
          module.setScale(true, function(){
            module.resize(config.sizes[size_count].scale.width, config.sizes[size_count].scale.height, function(){
              try {
                const load = nightmare
                  .screenshot('.' + job.folder + '/social/' + config.sizes[size_count].file + '.png', {x:0,y:0,width:config.sizes[size_count].scale.width,height:config.sizes[size_count].scale.height})

                await nightmare.then(function (result) {

                  if(config.sizes[size_count].scale.width != config.sizes[size_count].output.width || config.sizes[size_count].scale.height != config.sizes[size_count].output.height){
                    gm()
                      .in('.' + job.folder + '/social/' + config.sizes[size_count].file + '.png')
                      .background('#ffffff')
                      .gravity('center')
                      .extent(config.sizes[size_count].output.width, config.sizes[size_count].output.height)
                      .write('.' + job.folder + '/social/' + config.sizes[size_count].file + '.png', function(err){
                        if (err) throw err;
                        
                        size_count++
                        module.processSize()
                      });

                  }else{
                    size_count++
                    module.processSize()
                  }

                }).catch(function (error) {
                  console.error('Failed:', error);
                })

              } catch (error) {
                throw error;
              }
            })
          })
        })
      })
    }
  }

  module.goTo = async function (keyframe, nextFunc){
    try {
      const load = nightmare
        .evaluate(function (position) {
          init(position, function(position){return position;});
        }, keyframe)

      await nightmare.then(function (result) {
        nextFunc()
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