import io,json,sys,unittest
from urllib.error import HTTPError,URLError
from unittest.mock import patch
sys.path.insert(0,'backend')
import companion_services as music
class MusicBackendTests(unittest.TestCase):
 def setUp(self):music._metadata.clear();music._metadata_errors.clear()
 def test_canonical_links_keep_playback_identity_and_remove_tracking(self):
  self.assertEqual(music.canonical_music_url('https://open.spotify.com/intl-vi/embed/track/abc?si=tracking'),'https://open.spotify.com/track/abc')
  self.assertIn('www.youtube.com',music.metadata_endpoint('https://m.youtube.com/watch?v=abcdefghijk&si=tracking'))
  self.assertEqual(music.canonical_music_url('https://m.soundcloud.com/artist/private?secret_token=s-test&si=tracking'),'https://soundcloud.com/artist/private?secret_token=s-test')
 def test_bad_upstream_json_is_a_provider_error_not_invalid_user_input(self):
  for raw in (b'not json',b'[]',b'{}',b'x'*300001):
   with patch.object(music,'urlopen',return_value=io.BytesIO(raw)):
    with self.assertRaises(music.MusicProviderError) as caught:music.music_metadata('https://soundcloud.com/artist/track')
    self.assertEqual(caught.exception.status,502)
 def test_rate_limit_respects_retry_after_without_repeating_provider_requests(self):
  with patch.object(music.time,'time',return_value=100),patch.object(music,'urlopen',side_effect=HTTPError('https://soundcloud.com/oembed',429,'rate',{'Retry-After':'120'},None)) as request:
   for _ in range(2):
    with self.assertRaises(music.MusicProviderError) as caught:music.music_metadata('https://soundcloud.com/artist/track')
    self.assertEqual(caught.exception.status,429);self.assertEqual(caught.exception.retry_after,120)
   self.assertEqual(request.call_count,1)
 def test_timeout_is_reported_and_success_metadata_is_cached(self):
  with patch.object(music,'urlopen',side_effect=URLError('timeout')):
   with self.assertRaises(music.MusicProviderError) as caught:music.music_metadata('https://soundcloud.com/artist/track')
   self.assertEqual(caught.exception.status,504)
  with patch.object(music,'urlopen',return_value=io.BytesIO(json.dumps({'title':'Track','author_name':None,'thumbnail_url':'javascript:test'}).encode())) as request:
   value=music.music_metadata('https://soundcloud.com/artist/track?si=one');self.assertEqual(value,{'title':'Track','author_name':'','thumbnail_url':''})
   self.assertEqual(music.music_metadata('https://soundcloud.com/artist/track?si=two'),value);self.assertEqual(request.call_count,1)
 def test_final_redirect_at_limit_is_accepted_without_an_extra_network_request(self):
  count=[0]
  def opener(req,**kw):
   count[0]+=1
   dest='https://on.soundcloud.com/'+str(count[0]) if count[0]<5 else 'https://soundcloud.com/artist/track'
   raise HTTPError(req.full_url,302,'redirect',{'Location':dest},None)
  self.assertEqual(music.resolve_music_share('https://on.soundcloud.com/start',opener),'https://soundcloud.com/artist/track');self.assertEqual(count[0],5)
