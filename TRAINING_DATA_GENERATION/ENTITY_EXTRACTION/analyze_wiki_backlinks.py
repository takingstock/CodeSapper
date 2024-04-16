import wikipediaapi

# Create a Wikipedia API object
wiki_wiki = wikipediaapi.Wikipedia(language='en', user_agent='vikBOT/vikram.murthy@gmail.com')

def getBackLinks( page_title ):

    # Retrieve the page object
    page = wiki_wiki.page(page_title)

    # Check if the page exists
    if page.exists():
        # Get the number of incoming links
        num_incoming_links = len(page.backlinks)
        
        print("Number of incoming links to the page '{}': {}".format(page_title, num_incoming_links))
        with open('Einstein_backlinks.txt', 'a') as fp:
            fp.write( str(page.backlinks) )
    else:
        print("Page '{}' does not exist.".format(page_title))

