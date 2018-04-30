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
    console.log('nghtmr:init')
    config = _config
    render_callback = callback
    update_callback = _update_callback
    social_callback = _social_callback

    return new Promise((resolve, reject) => {

      try {
        const load = nightmare
          .on('page', (type, message, stack)=>{
            console.log('nghtmr:vnt:page', type, message)
          })
          .on('console', (log, msg) => {
              console.log('nghtmr:vnt:console', log, msg)
          })
          .on('javascript', (log, msg) => {
              console.log('nghtmr:vnt:javascript', log, msg)
          })
          .on('log', (log, msg) => {
              console.log('nghtmr:vnt:log', log, msg)
          })
          .on('nightmare', (log, msg) => {
              console.log('nghtmr:vnt:nightmare', log, msg)
          })
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
        .evaluate(function (data) {
          setScale(data);
        }, scale)
        .then(() => { 
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
        .evaluate(function (data) {
          vis(data);
        }, data)
        .then(() => {
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

    return new Promise((resolve, reject) => {
      forEachPromise((Array.apply(null, {length: job.data.params.duration}).map(Number.call, Number)), (snap_count)=>{
        console.log('nghtmr:snap:forEachPromise', snap_count)
        return new Promise((resolve, reject) => {
          nightmare
            .screenshot('.' + job.folder + '/png/' + module.formatNumber(snap_count) + '.png', {x:0,y:0,width:config.video.output.width,height:config.video.output.height})
            .then(() => {
              console.log('.' + job.folder + '/png/' + module.formatNumber(snap_count) + '.png')
              console.log('nghtmr:snap-scrnsht', snap_count, (snap_count / job.data.params.duration))
              update_callback('png', (snap_count / job.data.params.duration))
              return module.goTo((snap_count / job.data.params.duration))
            })
            .then(()=>{
              console.log('nghtmr:snap:resolve-inner',snap_count)
              resolve()
            })
            .catch(reason => {
              console.error('render-nightmare:snap', reason)
              reject()
            })
        })
      }).then(()=>{
        console.log('nghtmr:snap:resolve')
        resolve()
      }).catch(reason => {
        console.error('render-nightmare:snap-outer', reason)
        reject()
      })
    })
    
  }

  //The SVG output is optimized for Browser, Adobe Illustrator and Sketch App

  module.cleanSVG = function (svg, width, height){
    console.log('nghtmr:cleanSVG')
    console.log(svg)
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
          let svg = getSVG()
          //console.log('svg',svg)
          return svg
        }).then(function (result) {
          fs.writeFileSync('.' + job.folder + '/' + job.id + '.svg', module.cleanSVG(result, config.video.size.width, config.video.size.height), 'utf8')

          update_callback('svg', 1)
          render_callback('renderDone');
          resolve()

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

    return new Promise((resolve, reject) => {
      forEachPromise(config.sizes, size => {
        return new Promise((resolve, reject) => {

          module.setScale(false)
            .then(()=>{
              return module.resize(size.size.width, size.size.height)
            })
            .then(()=>{
              return module.setScale(true)
            })
            .then(()=>{
              return module.resize(size.scale.width, size.scale.height)
            })
            .then(()=>{
              return module.setScale(false)
            })
            .then(()=>{
              return module.goTo(1)
            })
            .then(()=>{
              return module.setScale(true)
            })
            .then(()=>{
              console.log('nghtmr-processSize:screenshot-before')
              return new Promise((resolve, reject) => {
                nightmare
                  .screenshot('.' + job.folder + '/social/' + size.file + '.png', {x:0,y:0,width:size.scale.width,height:size.scale.height})
                  .then(function (result) {
                    console.log('.' + job.folder + '/social/' + size.file + '.png')
                    console.log('nghtmr-processSize:screenshot')
                      if(size.scale.width != size.output.width || size.scale.height != size.output.height){
                        gm()
                          .in('.' + job.folder + '/social/' + size.file + '.png')
                          .gravity('Center')
                          .extent(size.output.width, size.output.height)
                          .background('#ffffff')
                          .write('.' + job.folder + '/social/' + size.file + '.png', function(err){
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
      }).then(()=>{

        //All the sizes are done. Prepare for keyframe rendering
        return new Promise((resolve, reject) => {
          social_callback()
          resolve()
        }).catch(()=>{
          reject()
        })

      })
      .then(()=>{
        return module.setScale(false)
      })
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
      }).then(()=>{
        return module.getSVG()
      }).then(()=>{
        resolve()
      }).catch(reason => {
        console.error('render-nightmare:processSize-outer', reason)
        reject()
      })
    })

  }

  module.reset = () => {
    console.log('nghtmr:reset')
    return new Promise((resolve, reject) => {

      nightmare
        .evaluate(function () {
          console.log('reset');
          reset()
        }).then(() => {
          resolve()
        })
        .catch(reason => {
          console.error('render-nightmare:reset', reason)
          reject()
        })

    })
  }

  module.goTo = (_keyframe) => {
    let keyframe = _keyframe

    console.log('nghtmr:goto', keyframe)

    return new Promise((resolve, reject) => {

      nightmare
        .evaluate(function (position) {
          console.log('nghtmr:goto:eval:'+position)
          init(position)
        }, keyframe)
        //.wait(100)
        .then(() => {
          console.log('goto done')
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

  /**
 * 
 * @param items An array of items.
 * @param fn A function that accepts an item from the array and returns a promise.
 * @returns {Promise}
 * Credit: https://stackoverflow.com/questions/31413749/node-js-promise-all-and-foreach
 */
  function forEachPromise(items, fn) {
      return items.reduce(function (promise, item) {
          return promise.then(function () {
              return fn(item);
          });
      }, Promise.resolve());
  }

  return module;
 
})();

module.exports = render;