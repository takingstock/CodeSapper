#https://en.wikipedia.org/w/api.php?action=parse&format=json&page=Pet_door&prop=wikitext&formatversion=2

import requests, sys, json

url = 'https://en.wikipedia.org/w/api.php'
headers = {
    'User-Agent': 'vikBOT',
    'From': 'vikram.murthy@gmail.com'  # This is another valid field
}

def getWiki( pg_text ):
    params = { 'action': 'parse', 'format': 'json', 'page': pg_text, 'prop': 'wikitext', 'formatversion': 2 }

    return requests.post( url, headers=headers, params=params )


if __name__ == '__main__':

    with open( sys.argv[1]+'.json', 'w+' ) as fp:
        json.dump( ( getWiki( sys.argv[1] ) ).json(), fp )
