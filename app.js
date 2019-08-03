const express = require('express');
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const GridFs = require('gridfs-stream');
const methodOverride = require('method-override');

const app = express();
//Use Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

//Mongo URI
const mongoURI = "mongodb://admin:admin123@ds261096.mlab.com:61096/showcase-components"

//Create Mongo Connection
const conn = mongoose.createConnection(mongoURI);

//Init Mongo Gridfs
let gfs;
conn.once('open', () => {
    //Init Stream
    gfs = GridFs(conn.db, mongoose.mongo);
    gfs.collection('uploads')
})

//create storage engine - https://github.com/devconcept/multer-gridfs-storage
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
          //generate name with 16 chars
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          //filename with extension will be added in DB
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
          };
          resolve(fileInfo);
        });
      });
    }
  });
  const upload = multer({ storage });
//@route GET
//@desc loads form
app.get('/', (req,res) => {
    //res.render('index');
    gfs.files.find().toArray((err,files) => {
        // check if files
        if(!files || files.length === 0) {
            res.render('index',{files:false});
        } else {
            files.map(file => {
                if(file.contentType === 'image/jpeg' || file.contentType == 'image/png') {
                    file.isImage = true;
                } else if(file.contentType === 'video/mp4') {
                    file.isVideo = true;
                }
            });
            res.render('index',{files:files})
        }
    });
});
app.use('/public', express.static(path.join(__dirname, '/public')))

// @route POST /upload
// @desc Uploads file to DB
app.post('/upload', upload.single('file'),(req,res) => {
    //res.json({file: req.file});
    res.redirect('/');
});

// @route GET /files
// @desc Display all Files in JSON
app.get('/files/', (req,res) => {
    gfs.files.find().toArray((err,files) => {
        // check if files?
        if(!files || files.length === 0) {
            return res.status(404).json({
                err: 'No files exists'
            });
        }

        //Files exists
        return res.json(files);
    });
});

// @route GET /files/:filename
// @desc Display single File in JSON
app.get('/files/:filename', (req,res) => {
    gfs.files.findOne({filename: req.params.filename}, (err,file) => {
        if(!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exists'
            });
        }
        //File exists
        return res.json(file);
    })
});

// @route GET /image/:filename
// @desc Display image
app.get('/image/:filename', (req,res) => {
    gfs.files.findOne({filename: req.params.filename}, (err,file) => {
        if(!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exists'
            });
        }
        //check if image
        if(file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
            //Read output to browser
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            res.status(404).json({
                err: 'Not an image'
            })
        }
    })
});

// @route GET /video/:filename
// @desc Display Video
app.get('/video/:filename', (req,res) => {
    gfs.files.findOne({filename: req.params.filename}, (err,file) => {
        if(!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exists'
            });
        }
        //check if video
        if(file.contentType === 'video/mp4') {
            //Read output to browser
            //const readstream = gfs.createReadStream(file.filename);
            
            // readstream.on('error', function(err) {
            //     if (err) {
            //         return res.status(400).json({
            //             err: 'Video not playing'
            //         });
            //     }
            // }).pipe(res);
            if (req.headers['range']) {
                var parts = req.headers['range'].replace(/bytes=/, "").split("-");
                var partialstart = parts[0];
                var partialend = parts[1];
    
                var start = parseInt(partialstart, 10);
                var end = partialend ? parseInt(partialend, 10) : file.length - 1;
                var chunksize = (end - start) + 1;
    
                res.writeHead(206, {
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Range': 'bytes ' + start + '-' + end + '/' + file.length,
                    'Content-Type': file.contentType
                });
    
                gfs.createReadStream({
                    _id: file._id,
                    range: {
                        startPos: start,
                        endPos: end
                    }
                }).pipe(res);
            } else {
                res.header('Content-Length', file.length);
                res.header('Content-Type', file.contentType);
    
                gfs.createReadStream({
                    _id: file._id
                }).pipe(res);
            }
        } else {
            res.status(404).json({
                err: 'Not an video'
            })
        }
    })
});

//@route Delete /files/:id
//@desc delete file
app.delete('/files/:id', (req,res) => {
    gfs.remove({_id : req.params.id, root:'uploads'}, (err,gridStore) => {
        if(err) {
            return res.status(404).json({err: err});
        } 
        res.redirect('/')
    })
})

const port = 5000;

app.listen(port,() => console.log(`server started on port ${port}`))