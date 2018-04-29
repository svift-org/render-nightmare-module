/*
 *
 * Add header info here
 *
 */

'use strict';

var fs = require('fs'),
  gm = require('gm')

var Nightmare = require('nightmare')
var nightmare = Nightmare({show:true})

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
    console.log('nghtmr:init')
    config = _config
    render_callback = callback
    update_callback = _update_callback
    social_callback = _social_callback

    return new Promise((resolve, reject) => {

      try {
        const load = nightmare
          .goto(default_job.url)
          .viewport(config.video.size.width, config.video.size.height)

        nightmare.evaluate(function(){
          //wait for page to finish loading
          return false
        }).then(function(){
          resolve()
        }).catch(reason => {
          console.error('render-nightmare:init', reason)
          reject()
        })

      } catch (error) {
        //TODO: Try again?
        throw error;
        reject()
      }

    })
  }

  module.resize = (width, height) => {
    console.log('nghtmr:resize')
    return new Promise((resolve, reject) => {
      nightmare
        .viewport(width, height)
        .evaluate(function(){
          //wait for page to finish loading
          return false
        })
        .then(result => {
          resolve()
        })
        .catch(reason => {
          console.error('render-nightmare:resize', reason)
          reject()
        })  
    })
  }

  module.setScale = scale => {
    console.log('nghtmr:scale')
    return new Promise((resolve, reject) => {
      nightmare
        .evaluate(function (data, done) {
          setScale(data, done);
        }, scale)
        .then(function(result){ 
          resolve()
        })
        .catch(reason => {
          console.error('render-nightmare:setScale', reason)
          reject()
        })
    })
  }

  module.render = (data, id, folder) => {
    console.log('nghtmr:render')
    size_count = 0
    job = {}
    for(var key in default_job){
      job[key] = default_job[key]
    }
    job.id = id
    job.data = data
    job.folder = folder
    if(!('duration' in job.data.params)){ job.data.params['duration'] = 100 }

    return new Promise((resolve, reject) => {
      nightmare
        .evaluate(function (data, done) {
          vis(data, done);
        }, data)
        .then(function (result) {
          return module.goTo(1)
        })
        .then(()=>{
          return module.processSize()
        })
        .then(()=>{
          resolve()
        })
        .catch(reason => {
          console.error('render-nightmare:render', reason)
          reject()
        })
      })
  }

  module.snap = () => {
    console.log('nghtmr:snap')
    job.snap_count++;
    
    return new Promise((resolve, reject) => {
      nightmare
        .screenshot('.' + job.folder + '/png/' + module.formatNumber(job.snap_count) + '.png', {x:0,y:0,width:config.video.output.width,height:config.video.output.height})
        .then(() => {
          update_callback('png', (job.snap_count / job.data.params.duration))

          if(job.snap_count == job.data.params.duration){
            return module.getSVG()
          }else{
            return module.goTo((job.snap_count / job.data.params.duration))
          }
        })
        .then(() => {
          if(job.snap_count == job.data.params.duration){
            return module.snap()
          }else{
            resolve()
          }
        })
        .then(() => {
          if(job.snap_count == job.data.params.duration){
            resolve()
          }
        })
        .catch(reason => {
          console.error('render-nightmare:snap', reason)
          reject()
        })
    })
  }

  //The SVG output is optimized for Browser, Adobe Illustrator and Sketch App

  module.cleanSVG = function (svg, width, height){
    console.log('nghtmr:cleanSVG')
    if(svg == undefined) return undefined

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

  module.getSVG = () => {
    console.log('nghtmr:getSVG')
    return new Promise((resolve, reject) => {
      nightmare
        .evaluate(function () {
          return getSVG()
        }).then(function (result) {
          fs.writeFileSync('.' + job.folder + '/svg/' + module.formatNumber(job.snap_count) + '.svg', module.cleanSVG(result, config.video.size.width, config.video.size.height), 'utf8')

          if(job.snap_count < job.data.params.duration){
            update_callback('svg', (job.snap_count / job.data.params.duration))
            return module.goTo((job.snap_count / job.data.params.duration))
          }else{
            render_callback('renderDone');
            resolve()
          }
        }).then(()=>{
          if(job.snap_count < job.data.params.duration){
            return module.snap()
          }else{
            resolve()
          }
        }).then(()=>{
          resolve()
        }).catch(reason => {
          console.error('render-nightmare:getSVG', reason)
          reject()
        })
    })
  }

  module.processSize = () => {
    console.log('nghtmr:processSize')
    if(size_count >= config.sizes.length){
      social_callback()

      return new Promise((resolve, reject) => {

        //All the sizes are done. Prepare for keyframe rendering
        module.setScale(false)
          .then(()=>{
            return module.resize(config.video.size.width, config.video.size.height)
          })
          .then(()=>{
            return module.reset()
          })
          .then(()=>{
            return module.setScale(true)
          })
          .then(()=>{
            return module.resize(config.video.output.width, config.video.output.height)
          })
          .then(()=>{
            return module.goTo(0)
          })
          .then(()=>{
            return module.snap()
          })
          .then(()=>{
            resolve()
          })
          .catch(()=>{
            reject()
          });
      })


    }else{

      return new Promise((resolve, reject) => {

        module.setScale(false)
          .then(()=>{
            return module.resize(config.sizes[size_count].size.width, config.sizes[size_count].size.height)
          })
          .then(()=>{
            return module.setScale(true)
          })
          .then(()=>{
            return module.resize(config.sizes[size_count].scale.width, config.sizes[size_count].scale.height)
          })
          .then(()=>{
            return module.goTo(1)
          })
          .then(()=>{
            return new Promise((resolve, reject) => {
              nightmare
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
                          resolve()
                        });

                    }else{
                      size_count++
                      resolve()
                    }

                  }).catch(reason => {
                    console.error('render-nightmare:processSize', reason)
                    reject()
                  })
            })
          })
          .then(()=>{
            resolve()
          })
          .catch(()=>{
            reject()
          })

      })
    }
  }

  module.reset = () => {
    console.log('nghtmr:reset')
    return new Promise((resolve, reject) => {

      nightmare
        .evaluate(function (done) {
          console.log('reset');
          reset(done);
        }).then(function (result) {
          resolve()
        })
        .catch(reason => {
          console.error('render-nightmare:reset', reason)
          reject()
        })

    })
  }

  module.goTo = (keyframe) => {
    console.log('nghtmr:goto')
    return new Promise((resolve, reject) => {

      nightmare
        .evaluate(function (position, done) {
          init(position, done)
        }, keyframe)
        .wait(100)
        .then(function (result) {
          resolve()
        })
        .catch(reason => {
          console.error('render-nightmare:goTo', reason)
          reject()
        })

    })
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