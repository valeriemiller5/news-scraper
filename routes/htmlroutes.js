var db = require("../models");
var axios = require("axios");
var cheerio = require("cheerio");

module.exports = function (app) {
    // Route to scrape the website for news articles, searching for specific info
    app.get("/scrape", function (req, res) {
        // Grab the articles to be rendered from the patch.com website
        axios.get("https://nytimes.com/").then(function (response) {
            var $ = cheerio.load(response.data);
            // console.log(response.data);
            // Grab every div with a class "css-1qiat4j" to get article information
            $("article.css-8atqhb").each(function (i, element) {
                // results will be saved to the empty object
                var result = {};

                // article information that will be saved in the object
                result.title = $(this).find("h2").text();
                console.log('This is line 19: ' + result.title);
                result.summary = $(this).find("li").text();
                console.log(`this is line 21: ${result.summary}`)
                result.link = $(this).find("a").attr("href");
                console.log(`this is line 23: ${result.link}`)

                db.News.create(result)
                .then(function(dbNews) {
                    // log the news stories scrapped from patch.com
                    console.log(`This is line 26: ${dbNews}`);
                }).catch(function (err) {
                    // if an error returns, display is in the server
                    return res.json(err);
                });
            });
            // if the scrape is successful, this message is logged
            res.send("Scrape Complete", result);
        });
    });

    // Open index page, render news articles in Handlebars
    app.get("/", function (req, res) {
        db.News.find({ saved: false }).then(function (data) {
            // handlebars object to collect data for the index.handlebars template
            var hbsObject = {
                news: data
            };
            // console.log("htmlroutes, line 36: " + hbsObject);
            res.render("index", hbsObject);
        }).catch(function (err) {
            res.json(err);
        })
    });

        // Route for saving/updating a news article's associated comment
    app.post("/newComment/:id", function (req, res) {
        // Create a new comment and pass the req.body to the entry
        db.Comments.create(req.body)
            .then(function (dbComment) {
                // If a comment was created successfully, find one news article with an `_id` equal to `req.params.id`. Update the news article to be associated with the new comment
                return db.News.findOneAndUpdate(
                    { _id: req.params.id },
                    { $push: { comments: dbComment._id } },
                    // { $push: { comments: dbComment.body } },
                    // { new: true } tells the query that we want it to return the updated comment
                    { new: true });
            // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
            }).then(function (dbNews) {
                res.json(dbNews);
            }).catch(function (err) {
                res.send(err);
            });
    });

    // Route for grabbing a specific news article by id, populate it with comments
    app.get("/newComment/:id", function (req, res) {
        // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
        db.News.findOne({ _id: req.params.id })
            // ..and populate all of the comments associated with it
            .populate("comments")
            .then(function (dbNews) {
                res.json(dbNews);
            })
            .catch(function (err) {
                res.json(err);
            });
    });

    // Route for saving an article to show in the favorites page
    app.post("/news/save/:id", function (req, res) {
        db.News.findOneAndUpdate(
            {_id: req.params.id}, 
            { saved: true })
        .then(function (dbNews) {
            res.send(dbNews);
        }).catch(function (err) {
            res.send(err);
        })
    });

    // Route for removing an article from the favorites page
    app.post("/news/delete/:id", function (req, res) {
        db.News.findOneAndUpdate(
            {_id: req.params.id}, 
            { saved: false })
        .then(function (dbNews) {
            res.send(dbNews);
        }).catch(function (err) {
            res.send(err);
        })
    });

    // Open page displaying favorite stories
    app.get("/favorites", function (req, res) {
        db.News.find({ saved: true })
        .populate("comments")
        .then(function (data) {
            // handlebars object to collect data for the index.handlebars template
            var hbsObject = {
                news: data
            };
            // renders data from patch.com in Handlebars
            res.render("favorites", hbsObject);
        }).catch(function (err) {
            res.json(err);
        })
    });

    // Deletes all unsaved articles from index.handlebars (saved articles will remain on favorites page unless server is reset or it is unfavorited).
    app.delete("/clear", function(req, res) {
        db.News.deleteMany({saved: false}, function(err) {
            res.send(err);
        })
    })

    // Render 404 page for any unmatched routes
    app.get("*", function (req, res) {
        res.render("404");
    });
};
